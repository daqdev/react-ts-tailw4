# CLAUDE.md

Guidance for agents working in this repository.

## Source of truth

`docs/SPEC.md` defines behaviour. Read the relevant section before changing a rule, and cite it in
code comments as `SPEC §n`. If the code and the spec disagree, raise it; don't silently pick one.
Open questions live in SPEC §15 (answered in M0) and §16.

## Module boundaries (SPEC §3)

- `strategy-core`: pure functions only. No Spring, no I/O, no `Instant.now()` or
  `System.currentTimeMillis()`; time and market data come in as arguments (`MarketFeed`, SPEC §17.2).
  The gateway, worker and backtester all reuse it; never duplicate strategy logic elsewhere.
- `gateway`: the only process that holds the Binance key, talks to Binance and touches the DB.
  It places an order only on the owner's approval, after re-validating it (SPEC §5.6, §6).
- `worker` and `backtester`: talk only to the gateway REST API. They never place orders.
- `dashboard`: no secrets.

## Invariants that must never break

- Money is `BigDecimal` in Java and `NUMERIC(38,18)` in SQL. Never `double`/`float`.
- Timestamps are stored in UTC; inject `java.time.Clock`. The dashboard displays
  `America/Argentina/Buenos_Aires` (`dashboard/src/format.ts`).
- No real subscription without an owner approval; tests never call the real Binance API.
  Use the `DualInvestmentClient` fake fed by recorded fixtures (SPEC §10).
- `hard_*` limits come from environment variables only (SPEC §6).
- Subscribe has no idempotency key: on an unknown result, query positions before anything else.
- Secrets never go in the repo, DB, logs or dashboard.

## Commands

```bash
./mvnw verify                          # all Java modules + tests (needs Docker for the gateway's Testcontainers test)
./mvnw -pl strategy-core test          # fast loop for strategy work
cd dashboard && pnpm build             # type-check + build
docker compose up -d --build           # full stack, needs .env (see README)
```

## Conventions

- Java package root `dev.daq.dualbot.<module>`; tests use JUnit 5 + AssertJ.
- Flyway migrations: `gateway/src/main/resources/db/migration/V<n>__<description>.sql`. Never
  edit a migration that has already been applied; add a new one.
- Every guardrail gets a failing-case test (SPEC §14 M4).
