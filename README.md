# Dual Investment Bot

Automates a premium-income cycle on Binance Dual Investment: USDT in **BTC Buy Low**; when
assigned, the BTC goes into **Sell High at the same strike** until it is sold back. Every order
is approved by the owner. A dashboard shows history and statistics, and a backtester replays the
strategy over past prices.

The full specification is [`docs/SPEC.md`](docs/SPEC.md) (v0.5). It is the source of truth; code
comments point to its sections (`SPEC §n`).

## Status

The repo has the scaffold and the first pure strategy code; the SPEC milestones themselves start at M0.

| Milestone | Deliverable | Status |
|---|---|---|
| — | Scaffold: modules, Compose stack, CI, payout arithmetic with the §2 worked example | ✅ |
| M0 | Spike with a read-only key, fixtures, answers to SPEC §15 | next |
| M1 | Gateway + DB + worker in `OBSERVE` | |
| M2 | Read-only dashboard | |
| M3 | `strategy-core` + `PAPER` | |
| M4 | `CONFIRM` + guardrails + Telegram approval | |
| M5 | Cycles screen, statistics, resilience | |
| M6 | Backtester (SPEC §17) | |

## Layout

| Path | What | Must not |
|---|---|---|
| `strategy-core/` | SPEC §5 rules as pure functions. Plain Java, no Spring | Do I/O or read the system clock |
| `gateway/` | Spring Boot. Only holder of the Binance key; guardrails; owns PostgreSQL (Flyway); REST API for everyone else | Decide or initiate trades |
| `worker/` | Spring Boot scheduler for the live strategy. Stateless | Talk to Binance or the DB; execute orders |
| `backtester/` | Spring Boot. Runs queued backtests, calibrates the APR model | Create real proposals or subscriptions |
| `dashboard/` | Vue 3 + PrimeVue 4 + Vite. One placeholder per SPEC §11 screen | Hold any secret |
| `docs/SPEC.md` | The specification | |
| `secrets/` | Docker secrets, git-ignored (see its README) | |

Stack: Java 21, Spring Boot 3.5, Maven, Flyway, PostgreSQL 16, Vue 3, PrimeVue 4, pnpm.

## Development

Requirements: JDK 21, Node 22 with pnpm 10 (`corepack enable`), Docker.

```bash
./mvnw verify                      # build + all tests (the gateway test starts PostgreSQL via Testcontainers)
```

Run the gateway against a throwaway PostgreSQL:

```bash
docker run -d --name dualbot-pg -p 127.0.0.1:5432:5432 \
  -e POSTGRES_DB=dualbot -e POSTGRES_USER=dualbot -e POSTGRES_PASSWORD=dualbot postgres:16-alpine
./mvnw -q -pl gateway -am package -DskipTests
HARD_MAX_PER_SUBSCRIPTION_USDT=1000 HARD_MAX_TOTAL_USDT=5000 java -jar gateway/target/gateway-*.jar
```

- `GET http://localhost:8080/api/health` gives the gateway status.
- The OpenAPI JSON is at `/api/openapi` and Swagger UI at `/api/docs`.
- The gateway refuses to start without the `HARD_*` caps (SPEC §6).

Run the dashboard with hot reload (it proxies `/api` to `localhost:8080`):

```bash
cd dashboard && pnpm install && pnpm dev     # http://localhost:5173
```

## Running the whole stack

```bash
cp .env.example .env                         # then edit DB_PASSWORD and the HARD_* caps
touch secrets/binance_private_key.pem        # empty until M0; see secrets/README.md
docker compose up -d --build
```

The dashboard is at `http://127.0.0.1:8081`, and nginx proxies `/api` to the gateway. To reach it
from other devices on your LAN or VPN, set `DASHBOARD_BIND` to that interface's address. Never
publish it to the internet (SPEC §13).

## Moving to its own repository

This project started on a branch with its own root commit, so its history doesn't depend on any
other repository. To move it, create an empty repository and push the branch as `main`:

```bash
git remote add dualbot git@github.com:<owner>/<new-repo>.git
git push dualbot HEAD:main
```
