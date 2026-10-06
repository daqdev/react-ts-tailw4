# SPEC — Binance Dual Investment Bot (BTC Buy Low / Sell High cycle)

Version 0.5 · 2026-10-04 · Owner: Decu · Status: draft for implementation

Changes in 0.5: no fixed budget. Capital is variable; the system shows offers, the owner picks product and amount, and capital is managed by the system from the moment a trade starts, and is freed with its profit when the trade ends (§5.8). A Buy Low that expires without assignment ends the trade. Removed `budget_usdt`, `tranche_usdt` and the automatic pacing rules. Orders are executed by the gateway at approval; the worker never triggers one.

Changes in 0.4:

- Sell High needs at least 5% APR; when no Sell High at the entry strike meets that, the cycle goes to an explicit `HODL` state until one does (§5.1, §5.3, §5.4).
- Every subscription is approved by the owner; there is no unattended mode (§5.6). Telegram is the approval channel (§12).
- No fixed IP is assumed (§13).

Changes in 0.3: the strategy is a premium-income cycle — Buy Low, and when assigned, Sell High at the same strike.

## 1. Goal

Automate the owner's routine on Binance Dual Investment and show history and statistics in a dashboard.

- Capital is **USDT**. The objective is **premium income**, not accumulating BTC.
- The amount is not fixed: the owner deposits USDT whenever he wants. The system shows potential trades; the owner accepts or declines each one and decides how much to put in. Capital comes under the system's scope the moment a trade starts with it, and goes back to the owner's free balance, with its profit, when the trade ends (§5.8).
- Normal state: USDT subscribed to **BTC Buy Low** (~15 days, 30–40% APR).
- If a Buy Low is exercised, the BTC received is subscribed to **Sell High at the same strike it was bought at**, repeatedly, until it is sold back to USDT.
- Thesis (the owner's assumption, not something the system guarantees): if price falls below the strike, it eventually comes back.

- If price falls so far that Sell High at that strike pays under 5% APR or is not offered, that batch of capital is simply held as BTC (**hodl**) until it is offered again. Other batches are unaffected.

The dashboard and the backtest must make the time spent in BTC and in hodl visible.

### Non-goals (v1)

- Other coins, spot or futures trading (including selling BTC at market), withdrawals or transfers.
- Unattended execution: no real subscription is ever sent without the owner's approval.
- Multi-user, multi-account, tax reporting.
- Using Binance's own auto-compound (the bot does its own rolling so it can re-pick the product each time).

## 2. Product mechanics (facts the code depends on)

| Fact | Value |
|---|---|
| Buy Low in API terms | `optionType=PUT`, `investCoin=USDT`, `exercisedCoin=BTC` |
| Sell High in API terms | `optionType=CALL`, `investCoin=BTC`, `exercisedCoin=USDT` |
| APR format | decimal string, `"0.35"` = 35% |
| Terms | strike, settle date and APR are fixed at subscription |
| Cancellation | **impossible** — no edit, cancel or early redeem |
| Settlement price | average market price over the 30 min before 08:00 UTC on settle date (05:00 Buenos Aires) |
| Payout | credited to Spot wallet within 6 h (by 14:00 UTC) |
| Fees | none |

Payout, with `r = apr × duration_days / 365`:

| Product | Settlement price vs strike | Receive |
|---|---|---|
| Buy Low | above (not exercised) | `amount_usdt × (1 + r)` USDT |
| Buy Low | at/below (exercised) | `amount_usdt × (1 + r) / strike` BTC |
| Sell High | below (not exercised) | `amount_btc × (1 + r)` BTC |
| Sell High | at/above (exercised) | `amount_btc × (1 + r) × strike` USDT |

Behaviour at exact equality is unconfirmed (§15).

Worked example of one full cycle — 1,000 USDT, strike 95,000:

1. Buy Low, APR 35%, 15 days: `r` = 0.35 × 15 / 365 = 0.014384.
   - Not exercised: 1,014.38 USDT.
   - Exercised: 1,014.38 / 95,000 = 0.01067772 BTC.
2. Sell High at 95,000 with that BTC, APR 20%, 15 days: `r` = 0.20 × 15 / 365 = 0.008219.
   - Not exercised: 0.01067772 × 1.008219 = 0.01076548 BTC → repeat step 2.
   - Exercised: 0.01067772 × 1.008219 × 95,000 = 1,022.72 USDT → cycle closed, +2.27% in 30 days.

## 3. Architecture

Five containers in one Docker Compose stack, self-hosted.

```
 dashboard (Vue 3) ────HTTP──▶ gateway (Spring Boot) ──HTTPS──▶ Binance REST
 worker (Spring Boot) ──HTTP──▶     │
 backtester (Spring Boot) ─HTTP─▶   ▼
                                PostgreSQL
```

| Component | Responsibility | Must NOT |
|---|---|---|
| **gateway** | Only holder of the Binance API key. Exchange client, guardrails, DB owner, REST API for the other components. Executes a trade only on the owner's approval, after re-validating it. | Decide or initiate trades |
| **worker** | Scheduler for the live strategy: snapshots, offers, settlement checks. Stateless: reads and writes only through the gateway API. | Talk to Binance or the DB directly; execute orders |
| **backtester** | Runs queued backtests and calibrates the APR model (§17). Same rules as the worker. | Create real proposals or subscriptions |
| **dashboard** | Monitoring, history, statistics, config, approvals, kill switch, backtests. | Hold any secret |
| **postgres** | Persistence. | — |

Maven modules: `strategy-core` (the §5 rules as pure functions: no I/O, no system clock), `gateway`, `worker`, `backtester`. Gateway, worker and backtester all depend on `strategy-core` (the gateway only to re-validate an offer at approval); strategy code is never duplicated.

Why this split: the key lives in one process, the money limits are enforced where the key is (a worker bug cannot overspend), and stopping the worker is a safe "off" while the dashboard keeps working.

### Stack (default, change if the factory has a standard)

- Java 21, Spring Boot 3.x, Maven. Flyway for migrations.
- Binance client: official `io.github.binance:binance-dual-investment` (3.0.1 on Maven Central at time of writing), wrapped behind an interface `DualInvestmentClient` so it can be faked in tests.
- Vue 3 + PrimeVue 4 + a chart library (ECharts).
- PostgreSQL 16.
- Money as `BigDecimal` / `NUMERIC(38,18)`. Never `double`.
- All timestamps stored in UTC; dashboard displays `America/Argentina/Buenos_Aires`.

## 4. Binance API used

Base URL `https://api.binance.com`. The `/sapi/v1/dci/*` calls and `/api/v3/account` are signed (`X-MBX-APIKEY` header + `timestamp` + `signature`). The `dci` calls cost weight 1 each.

| Call | Use |
|---|---|
| `GET /sapi/v1/dci/product/list` | Params: `optionType`, `exercisedCoin`, `investCoin`, `pageSize` (max 100), `pageIndex`. Returns `id`, `orderId`, `strikePrice`, `duration`, `settleDate`, `purchaseEndTime`, `canPurchase`, `apr`, `minAmount`, `maxAmount`, `purchaseDecimal`. |
| `POST /sapi/v1/dci/product/subscribe` | Params: `id`, `orderId`, `depositAmount`, `autoCompoundPlan` (always `NONE`). Returns `positionId`, `purchaseStatus`, `apr`, `strikePrice`, `settleDate`, `purchaseTime`. |
| `GET /sapi/v1/dci/product/positions` | Params: `status` (optional), `pageSize`, `pageIndex`. Returns `id`, `subscriptionAmount`, `strikePrice`, `duration`, `settleDate`, `purchaseStatus`, `apr`, `orderId`, `optionType`, `subscriptionTime`. |
| `GET /sapi/v1/dci/product/accounts` | Totals in BTC and USDT. |
| `GET /api/v3/account` | Spot balances (free USDT, BTC). |
| `GET /sapi/v1/account/apiRestrictions` | The key's own permissions (`ipRestrict`, `enableReading`, `enableSpotAndMarginTrading`, `enableWithdrawals`, `enableInternalTransfer`, `permitsUniversalTransfer`, `enableMargin`, `enableFutures`…). Used for the self-check in §13. |
| `GET /api/v3/ticker/price`, `GET /api/v3/klines` | BTCUSDT spot price; 1-minute candles for settlement price. Public. |

Position statuses: `PENDING`, `PURCHASE_SUCCESS`, `SETTLING`, `SETTLED`, `PURCHASE_FAIL`, `REFUNDING`, `REFUND_SUCCESS`.

Rules for the client:

- Rate limit: 12,000 weight/min per IP on `/sapi`. Read `X-SAPI-USED-IP-WEIGHT-1M`; on HTTP 429 honour `Retry-After`. Expected usage is under 10 calls/min.
- Signing: Ed25519 key preferred. Percent-encode the payload **before** signing (mandatory since 2026-01-15, otherwise `-1022 INVALID_SIGNATURE`). `recvWindow` ≤ 60000. Sync clock against `GET /api/v3/time`.
- Subscribe error `"Products are not available"` means the APR dropped or the order is gone: discard the candidate, re-fetch the list, re-evaluate from scratch.
- **Subscribe has no idempotency key.** On timeout or unknown result: never retry blindly. First query positions and match by `orderId` + amount + `subscriptionTime`; only if no match, treat as not executed.
- **There is no testnet for `/sapi` endpoints.** See §10.

## 5. Strategy (`strategy-core`, run live by the worker)

### 5.1 The cycle

A **cycle** is one trade: one batch of capital under the system's scope. It starts when the owner approves a Buy Low (§5.8) and ends in one of three ways: the Buy Low expires without assignment, the BTC is sold back through a Sell High, or the owner releases it. Cycles are independent and can have different sizes. States:

| State | Holds | Meaning |
|---|---|---|
| `BUY_LOW_OPEN` | locked USDT | Buy Low running |
| `BTC_IDLE` | BTC | Just assigned, or a Sell High expired unsold; a flip is offered on the next tick |
| `SELL_HIGH_OPEN` | locked BTC | Sell High running at the entry strike |
| `HODL` | BTC | No eligible Sell High right now; waiting |
| `CLOSED` | — | Finished; `close_reason` = `NOT_ASSIGNED`, `SOLD_BACK` or `RELEASED` (terminal) |

```
 approved Buy Low ─▶ BUY_LOW_OPEN ─▶ (above strike) ─▶ CLOSED: USDT + interest back to Available
                    │
                    └─▶ (at/below strike K) ─▶ BTC_IDLE, entry_strike = K

 BTC_IDLE ─▶ eligible Sell High? ─ yes ─▶ SELL_HIGH_OPEN ─▶ (at/above K) ─▶ CLOSED: USDT back to Available
                    │                           │
                    no                          └─▶ (below K) ─▶ BTC_IDLE
                    ▼
                  HODL ─▶ re-check every tick ─▶ eligible again ─▶ SELL_HIGH_OPEN
```

Invariants:

- A cycle never sells BTC below its `entry_strike`.
- The bot only uses BTC it tracks inside cycles. Other BTC in the Spot wallet is never touched.
- While a cycle holds BTC, Sell High interest stays inside it (its BTC balance grows).
- Cycles are independent: one waiting in BTC does not stop the others.

### 5.2 Buy Low leg — candidates and ranking

A product is a candidate when all hold:

1. `canPurchase = true` and `purchaseEndTime` more than 10 min away.
2. `duration` within `[duration_min_days, duration_max_days]`.
3. `apr` within `[apr_min, apr_max]`.
4. `strikePrice` < current spot, and at least `min_discount_pct` below it.
5. The amount on offer is at least `minAmount` (and capped at `maxAmount`).

Ranking by `selection_mode` (the first is the **recommended** one; the top `offer_top_n` are offered):

- `LOWEST_STRIKE` (default): biggest discount that still pays at least `apr_min`.
- `CLOSEST_TO_TARGET_APR`: nearest to `apr_target`.
- `HIGHEST_APR`: strike closest to spot.

Tie-break: duration closest to `duration_target_days`.

No candidate → no Buy Low offer; record the reason, retry next tick.

There is no automatic pacing or pausing: when and how much to commit is the owner's decision on each offer (§5.8).

### 5.3 Sell High leg (cycle in `BTC_IDLE` or `HODL`)

The strike is fixed by the cycle; there is no APR band, only a floor.

A Sell High product is **eligible** when all hold:

1. `canPurchase = true` and `purchaseEndTime` more than 10 min away.
2. Strike equals `entry_strike`. If that strike is not on the list at all, the **lowest listed strike above** it (happens when the strike is off the grid, or spot is already above it).
3. `apr ≥ sell_min_apr` (default 5%).
4. Cycle BTC balance, rounded down to `purchaseDecimal`, within `[minAmount, maxAmount]`.

Choice among eligible products: duration within `[sell_duration_min_days, sell_duration_max_days]`, closest to `sell_duration_target_days`. If none is in that window and `sell_any_duration = true`, the closest duration outside it.

Outcome of each tick:

- Eligible product found → offer it for the whole BTC balance; on approval → `SELL_HIGH_OPEN`.
- None found (strike not listed, or APR under the floor) → `HODL`. Record which of the two reasons.
- A cycle in `HODL` is re-evaluated every tick and leaves it as soon as a product is eligible.

No waiting period: the flip is proposed on the first tick after the BTC is credited (and, like every order, sent only after approval, §5.6).

For orientation — theoretical values before Binance's margin, entry strike 95,000, 15 days: Sell High APR drops under 5% when spot is about 14% below the strike at 45% volatility (≈81,800) and about 19% below at 60% volatility (≈76,500).

### 5.4 After each settlement

| Leg | Outcome | New state | Cycle balance |
|---|---|---|---|
| Buy Low | not exercised | `CLOSED` (`NOT_ASSIGNED`) | `usdt × (1 + r)` returns to Available |
| Buy Low | exercised | `BTC_IDLE`, `entry_strike = strike` | `usdt × (1 + r) / strike` BTC |
| Sell High | not exercised | `BTC_IDLE` | `btc × (1 + r)` |
| Sell High | exercised | `CLOSED` (`SOLD_BACK`) | `btc × (1 + r) × strike` USDT returns to Available |

`HODL` involves no settlement: the balance does not change while in it.

On close, record `usdt_in`, `usdt_out`, profit, days, days in BTC, days in `HODL`, and number of subscriptions. Freed capital is not re-committed automatically: it shows up as Available and the owner starts a new trade if and when he wants.

### 5.5 Default config (all editable from the dashboard, every change versioned)

| Key | Default |
|---|---|
| `mode` | `OBSERVE` |
| `apr_min` / `apr_max` / `apr_target` | 0.30 / 0.40 / 0.35 |
| `duration_min_days` / `duration_max_days` / `duration_target_days` | 12 / 18 / 15 |
| `selection_mode` | `LOWEST_STRIKE` |
| `min_discount_pct` | 0 |
| `usdt_reserve` | 0 |
| `offer_top_n` | 5 |
| `offer_digest_time` | 09:00 local (empty = off) |
| `paper_initial_usdt` | 10,000 |
| `sell_min_apr` | 0.05 |
| `sell_duration_min_days` / `sell_duration_max_days` / `sell_duration_target_days` | 12 / 18 / 15 |
| `sell_any_duration` | true |
| `stuck_alert_days` | 60 |
| `proposal_ttl_hours` | 6 |
| `proposal_reminder_hours` | 2 |

### 5.6 Modes

| Mode | Behaviour |
|---|---|
| `OBSERVE` | Collect snapshots and sync positions only. No decisions executed. |
| `PAPER` | Full strategy, both legs, same offer and approval flow; subscriptions are simulated against a virtual wallet of `paper_initial_usdt` and settled against real prices. |
| `CONFIRM` | The worker produces offers (§5.8); nothing is sent to Binance until the owner approves one. This is the only mode that places real orders. |

Approval rules (`CONFIRM`):

- An offer is stored as a `proposal` record ("offer" is the owner-facing word). At most one open proposal per cycle, plus one for Available capital. Shown in the dashboard and sent to Telegram.
- Each tick refreshes open proposals with current APRs. A product that stops being eligible drops out; if none is left the proposal becomes `STALE`. The owner is notified when the recommended product changes, not on every APR move.
- The owner approves **one product and one amount** (the amount is fixed for flips). The gateway then re-fetches the list and subscribes only if that product (leg, strike, settle date) is still eligible under §5.2 / §5.3 and the amount is within what §5.8 allows. Otherwise it answers "no longer valid" and shows the current offers.
- Not answered: reminder after `proposal_reminder_hours`; `EXPIRED` after `proposal_ttl_hours`, then a fresh proposal on the next tick. The capital simply stays idle meanwhile.
- Declined: the offer stays visible in the dashboard; no Telegram message about it until the next daily digest.

### 5.7 Schedule

| Job | Frequency |
|---|---|
| Snapshot both product lists (Buy Low and Sell High) + spot price | every 15 min |
| Sync positions and balances | every 5 min |
| Compute offers for Available capital and for every cycle holding BTC | every 15 min, after the snapshot |
| Settlement check | daily 08:05 UTC |
| Balance reconciliation | daily 14:05 UTC |
| Heartbeat to gateway | every 1 min |
| API key self-check (§13) | at gateway start and daily |

### 5.8 Capital and offers

There is no fixed budget. USDT in the Spot wallet is in one of two pools:

| Pool | Definition |
|---|---|
| **Managed** | Capital inside open cycles: running Buy Lows, and BTC waiting or running in Sell High |
| **Available** | Free Spot USDT − `usdt_reserve` |

A deposit simply raises Available; the bot sees it on the next balance sync and notifies. Capital enters the system's scope only when the owner approves a trade with it, and leaves it when that trade ends.

Offers (potential trades), recomputed every tick:

| Kind | Offered when | Products | Amount |
|---|---|---|---|
| `NEW` | Available ≥ the smallest `minAmount` | Top `offer_top_n` Buy Low candidates (§5.2), recommended one flagged | Owner chooses, up to Available. Approval creates a cycle of that size. |
| `FLIP` | A cycle is in `BTC_IDLE` or `HODL` and an eligible Sell High exists (§5.3) | That one product | Always the cycle's whole BTC balance. |

Owner actions:

- **Approve** an offer, choosing product and amount where allowed.
- **Decline** it.
- **Release** a cycle holding BTC (`BTC_IDLE` or `HODL`): the cycle closes and its BTC leaves the system's scope. Not possible while a position is open. It is recorded with its value at spot and flagged as released in statistics.

Shown with every Buy Low offer, so the owner decides with context:

- Available and Managed totals; how many cycles are in BTC and in `HODL`.
- Settle dates of open positions (to spread them if wanted).
- A warning when `amount / strike` is below the Sell High `minAmount`: that batch could not be flipped if assigned.

Example: Available is 2,500 USDT. The owner approves 1,000 on a Buy Low at 95,000 → cycle #7 starts with 1,000; Available 1,500. He deposits 3,000 → Available 4,500. Cycle #7 expires without assignment → it closes with 14.38 profit and its 1,014.38 returns; Available 5,514.38. Had it been assigned, cycle #7 would hold 0.01067772 BTC and get flip offers at 95,000, with Available unchanged at 4,500.

## 6. Guardrails (enforced in the gateway on every subscribe)

Reject, log, and notify when any fails:

All subscriptions:

- Kill switch is on.
- Product is neither `PUT` / `USDT` / `BTC` nor `CALL` / `BTC` / `USDT`.
- A Buy Low does not come from an approved `NEW` offer; a Sell High is not tied to a cycle in `BTC_IDLE` or `HODL`.
- More than `hard_max_subscriptions_per_day` (default 6).
- `mode` is not `CONFIRM`, or there is no valid, unused owner approval for exactly this product and amount.
- The API key self-check (§13) has failed.

Buy Low:

- Amount > `hard_max_per_subscription_usdt`.
- Amount above Available.
- Total committed after the call > `hard_max_total_usdt`. Committed = open Buy Lows + the `usdt_in` of every cycle currently in BTC. This cap is the only ceiling on Managed capital.
- APR outside 0.05–1.00 (sanity check against bad data).
- Strike ≥ spot.

Sell High:

- Amount > the BTC balance of the referenced cycle.
- Strike < the cycle's `entry_strike`.
- APR below `sell_min_apr` or above 1.00.

`hard_*` limits come from environment variables, not the DB: changing them requires a redeploy.

## 7. Settlement outcome

The positions endpoint does not document a settlement price or delivered amount, so the bot derives it:

1. At 08:05 UTC on settle date, compute `settlement_price_est` = mean of BTCUSDT 1-minute closes 07:30–08:00 UTC.
2. `outcome_est`: Buy Low is `EXERCISED` if `settlement_price_est ≤ strike`; Sell High if `settlement_price_est ≥ strike`. Within 0.1% of the strike, mark `UNCERTAIN`.
3. At 14:05 UTC, confirm using the Spot balance change against the §2 payout table. Set `outcome_confirmed` and move the cycle per §5.4.
4. If the confirmation contradicts the estimate or balances do not match, flag `NEEDS_REVIEW`, freeze that cycle, and notify.

The cycle only changes state on a **confirmed** outcome, never on the estimate.

## 8. Data model

| Table | Key columns |
|---|---|
| `product_snapshot` | `taken_at`, `option_type`, `product_id`, `order_id`, `strike`, `duration`, `settle_date`, `apr`, `min_amount`, `max_amount`, `can_purchase`, `spot_price` |
| `cycle` | `id`, `created_at`, `created_from` (`NEW` / `ADOPTED`), `state`, `usdt_in`, `btc_balance`, `entry_strike`, `entered_btc_at`, `hodl_since`, `hodl_reason` (`NOT_LISTED` / `APR_BELOW_MIN`), `frozen`, `closed_at`, `close_reason` (`NOT_ASSIGNED` / `SOLD_BACK` / `RELEASED`), `usdt_out`, `buy_low_count`, `sell_high_count`, `days_in_btc`, `days_in_hodl` |
| `cycle_state_log` | `cycle_id`, `at`, `from_state`, `to_state`, `reason` |
| `capital_event` | `at`, `type` (`DEPOSIT_DETECTED` / `WITHDRAWAL_DETECTED` / `CYCLE_STARTED` / `CYCLE_CLOSED` / `RELEASED`), `cycle_id`, `coin`, `amount` |
| `decision` | `at`, `cycle_id` (null = Available capital), `mode`, `leg`, `action` (`SUBSCRIBE` / `SKIP`), `reason`, `candidates_count`, `chosen_snapshot_id`, `config_version` |
| `proposal` | `decision_id`, `kind` (`NEW` / `FLIP`), `cycle_id` (null for `NEW`), `products` (json: ranked eligible products, recommended first), `suggested_amount`, `max_amount`, `status` (`PENDING` / `APPROVED` / `REJECTED` / `EXPIRED` / `STALE`), `approved_product`, `approved_amount`, `created_at`, `expires_at`, `answered_at`, `answered_via` (`DASHBOARD` / `TELEGRAM`) |
| `position` | `binance_position_id`, `cycle_id`, `leg` (`BUY_LOW` / `SELL_HIGH`), `source` (`BOT` / `MANUAL` / `PAPER`), `invest_coin`, `amount`, `strike`, `apr`, `duration`, `subscribed_at`, `settle_date`, `status`, `spot_at_subscription`, `settlement_price_est`, `outcome`, `outcome_confirmed`, `received_usdt`, `received_btc` |
| `balance_snapshot` | `taken_at`, `usdt_free`, `btc_free`, `usdt_available`, `usdt_managed`, `dci_total_usdt` |
| `config` | `version`, `json`, `changed_at` |
| `audit_log` | `at`, `actor` (`WORKER` / `OWNER` / `GATEWAY`), `event`, `payload` — every Binance write call with request and response |
| `worker_heartbeat` | `at`, `last_job`, `status` |

Positions opened by hand in the Binance app are imported with `source = MANUAL`, shown and counted in statistics, but not managed. The owner can **adopt** one from the dashboard: a cycle is created around it, and from then on the bot manages it (including the Sell High flip).

Backtesting tables (§17), kept separate from live tables:

| Table | Key columns |
|---|---|
| `kline` | `symbol`, `interval` (`1h` / `1m`), `open_time`, `open`, `high`, `low`, `close` |
| `vol_index` | `at`, `source` (`REALIZED_30D` / `DVOL`), `value` |
| `apr_model_version` | `id`, `type`, `option_type`, `calibrated_at`, `sample_count`, `snapshot_from`, `snapshot_to`, `params` (json), `error_mape` |
| `backtest_run` | `id`, `sweep_id`, `params` (json), `status`, `apr_model_version_id`, `summary` (json), `started_at`, `finished_at` |
| `backtest_position` | `run_id` + the `position` columns + `apr_source` |
| `backtest_cycle` | `run_id` + the `cycle` columns |
| `backtest_equity` | `run_id`, `day`, `usdt`, `btc`, `value_at_spot`, `value_at_entry_strike`, `benchmark_btc_hold` |

## 9. Gateway REST API

| Method + path | Caller | Purpose |
|---|---|---|
| `GET /api/market/products?leg` | worker, dashboard | Live product list for `BUY_LOW` or `SELL_HIGH` + spot price |
| `POST /api/market/snapshots` | worker | Persist a snapshot |
| `GET /api/market/snapshots?leg&from&to&duration` | dashboard | APR history |
| `GET /api/account` | worker, dashboard | Free USDT/BTC, Available and Managed totals |
| `GET /api/cycles` · `GET /api/cycles/{id}` | worker, dashboard | Open and closed cycles |
| `POST /api/cycles/{id}/release` | dashboard | Release a cycle holding BTC; the BTC leaves the system's scope |
| `POST /api/positions/sync` | worker | Pull positions from Binance, upsert |
| `GET /api/positions?status&leg&from&to` | dashboard | List / history |
| `POST /api/positions/{id}/adopt` | dashboard | Create a cycle around a manual position |
| `POST /api/decisions` | worker | Record a tick's evaluation; creates or refreshes proposals (offers) |
| `GET /api/proposals?status` | dashboard | Open offers and their history |
| `POST /api/proposals/{id}/approve` | dashboard, Telegram handler | Body: chosen product and amount. The gateway re-validates, applies guardrails and subscribes — the only path that places an order |
| `POST /api/proposals/{id}/reject` | dashboard, Telegram handler | Decline an offer |
| `POST /api/settlements/check` · `/reconcile` | worker | §7 steps |
| `GET /api/stats?from&to` | dashboard | §11 statistics |
| `GET` / `PUT /api/config` | dashboard, worker | Strategy config |
| `POST /api/killswitch` | dashboard | On / off |
| `GET /api/health` | all | Gateway, worker heartbeat, last Binance call |
| `POST /api/market/klines/backfill` | dashboard | Start or resume the historical price download |
| `GET /api/market/klines?interval&from&to` | backtester | Historical candles |
| `GET /api/apr-model` · `POST /api/apr-model/versions` | dashboard, backtester | Current model versions and error; store a calibration |
| `POST /api/backtests` | dashboard | Queue a run or a sweep |
| `GET /api/backtests` · `GET /api/backtests/{id}` | dashboard | List, result |
| `GET /api/backtests/next` · `PUT /api/backtests/{id}/result` | backtester | Take a queued run, store its result |

Worker and backtester authenticate with separate tokens; dashboard with a single-user login. Publish as OpenAPI.

## 10. Testing without a testnet

- `DualInvestmentClient` has two implementations: real, and a fake fed by recorded JSON fixtures of real responses.
- Unit tests for filter, selection, the cycle state machine, payout arithmetic and guardrails. The full-cycle example in §2 is a required test case.
- `PAPER` mode runs the full loop, both legs, against live market data with no orders.
- First real order: `CONFIRM` mode at the product's `minAmount`.

## 11. Dashboard

| Screen | Content |
|---|---|
| **Overview** | Mode, kill switch, worker health; Available vs Managed USDT; managed capital in USDT vs in BTC; realized profit; value of BTC cycles at spot and at their entry strike; next settlement; number of open offers |
| **Offers** | The potential trades of §5.8: Buy Low offers with an amount field (max = Available) and flip offers per cycle, each with its context and warnings; approve / decline |
| **Cycles** | One row per open cycle, with a release action when it holds BTC: state, size, entry strike, distance of spot to entry strike (%), days in BTC, days in hodl and why, current Sell High APR at the entry strike vs the 5% floor, premiums collected so far |
| **Positions** | Open positions: leg, strike, APR, days left, distance of spot to strike (%), projected payout in both scenarios |
| **History** | Closed cycles (with profit and how they ended) and settled positions with outcome and received amounts; filter and CSV export |
| **Market** | Buy Low candidates with the one the bot would pick highlighted; Sell High quote at each cycle's entry strike; APR-over-time chart by strike distance and duration |
| **Statistics** | See below |
| **Decisions** | Every tick, per cycle: what was chosen or why it was skipped |
| **Config** | Edit §5.5 values, version history |
| **Backtest** | Run form; run list; result with equity curve vs benchmarks, cycles, positions, metrics and assumptions; side-by-side comparison of runs; model-fit panel (APR model error, sample count, snapshot date range) |

Statistics (per date range):

- Realized profit (USDT) = Σ over closed cycles of `usdt_out − usdt_in` (released cycles shown separately).
- Annualised return on capital = realized profit / Σ (Managed USDT × days) × 365, with BTC cycles counted at their `usdt_in`. Also shown over Managed + Available, to include idle money.
- Capital value now, two ways: BTC valued at spot, and BTC valued at each cycle's entry strike.
- Unrealized result of BTC cycles = Σ (`btc_balance × spot − usdt_in`).
- Assignment rate = Buy Lows exercised / Buy Lows settled.
- Cycles closed, by how they ended; average length; average Sell Highs needed to sell back.
- Share of capital-days spent in BTC, and in `HODL` specifically; longest time any cycle spent in each.
- Premium by leg: Buy Low (USDT), Sell High (BTC, and USDT when exercised).
- Approval: average time from proposal to answer; capital-days idle while waiting for approval.
- Benchmarks: hold USDT; buy and hold BTC from the start date.

## 12. Notifications

Telegram bot, **required**: it is the owner's approval channel away from the LAN.

- Run by the gateway with long polling: outbound connections only, so it needs no fixed IP and no open port.
- Only messages from the owner's configured chat id are accepted; everything else is ignored and logged.
- Buttons carry a single-use token bound to one proposal. Buy Low offers list the products and offer preset amounts (25 / 50 / 100% of the allowed maximum) or accept a typed amount; flips have a single Approve button. The gateway re-validates product and amount as in §5.6.
- Every answer is written to `audit_log`.

Messages: new Available USDT detected (with the best current offer), daily digest of offers at `offer_digest_time` while Available allows one, subscription executed, offer awaiting approval (and its reminder), settlement result, Buy Low assigned (together with the flip proposal), cycle entered `HODL` (with the reason) and cycle left `HODL`, cycle in BTC longer than `stuck_alert_days`, cycle closed with its profit and the new Available total, guardrail rejection, `NEEDS_REVIEW`, worker heartbeat missing for 10 min, Binance errors repeated 3 times.

## 13. Security

No fixed public IP is assumed.

- **Key type: self-generated Ed25519.** Binance limits system-generated (HMAC) keys without IP restriction to read-only; self-generated keys may hold other permissions without it.
- Permissions: reading plus the one `subscribe` requires (§15). Withdrawals, internal and universal transfers, margin and futures stay **off**.
- Self-check with `GET /sapi/v1/account/apiRestrictions` at start and daily: if any forbidden permission is on, the gateway refuses to send subscriptions and alerts.
- What compensates for the missing IP restriction: owner approval on every order, the hard caps in §6, and a private key readable only by the gateway container.
- Private key mounted as a Docker secret. Never in the DB, logs, repo or dashboard.
- Dashboard and gateway reachable only on the LAN/VPN, not published to the internet. Telegram is outbound only.
- Logs redact the API key and signatures.

Fixed IP later, without code changes: if `BINANCE_HTTPS_PROXY` is set, all Binance traffic leaves through that proxy (e.g. a small VPS with a static IP), and the key can then be IP-restricted. The proxy only tunnels TLS and never sees the key.

Binance error `-2015` (invalid key, IP or permissions): stop creating proposals, alert including the current public IP, keep retrying reads with backoff, resume automatically when calls succeed.

## 14. Milestones and acceptance

| # | Deliverable | Done when |
|---|---|---|
| M0 | Spike with a read-only key | Both product lists and positions fetched; fixtures recorded; items in §15 answered |
| M1 | Gateway + DB + worker in `OBSERVE` | 48 h of snapshots of both lists stored without gaps; existing manual positions imported |
| M2 | Dashboard read-only | Overview, Positions, History, Market show real data |
| M3 | `strategy-core` + `PAPER` | Decisions logged every tick; the §2 full cycle passes as a test (assignment, flip, exit); a paper position settles with correct payout |
| M4 | `CONFIRM` + guardrails + Telegram approval | One real Buy Low at `minAmount`, product and amount chosen from Telegram, creating a cycle and tracked to settlement; release works in `PAPER`; stale and expired proposals behave as in §5.6; every guardrail has a failing test; key self-check blocks a key with withdrawals enabled |
| M5 | Cycles screen + statistics + resilience | Two real Buy Low settlements completed; a flip and a `HODL` episode executed in `PAPER`; statistics match a manual calculation; a simulated `-2015` pauses, alerts and recovers |
| M6 | Backtester (§17) | Acceptance list in §17.11 passes |

M6 depends only on M1 (snapshots, price backfill) and M3 (`strategy-core`); it can be built in parallel with M4–M5.

## 15. To verify in M0 (not confirmed from documentation)

1. Which API key permission `subscribe` requires (expected: reading for queries, spot trading for subscribe).
2. Whether subscriptions draw from the Spot wallet only.
3. How far back `positions?status=SETTLED` returns history, and whether it includes fields beyond the documented ones (settlement price, delivered amount).
4. Exact exercise condition at equality, for both products.
5. Whether product `id` / `orderId` are stable between polls or rotate when the APR is re-quoted.
6. **Sell High listing range:** how far above spot strikes are listed, and whether a specific past strike (the entry strike) is normally available.
7. Sell High `minAmount` in BTC, for the "could not be flipped" warning (§5.8).
8. Whether BTC from an exercised Buy Low is free in Spot and usable for Sell High as soon as it is credited.
9. That a self-generated Ed25519 key **without IP restriction** can hold the permission `subscribe` requires, and whether that permission expires.

## 16. Owner decisions pending

None blocking. Defaults that can be changed later in Config: which product is flagged as recommended (`selection_mode`, default lowest strike in the 30–40% band) and the hard caps set at deploy (`hard_max_per_subscription_usdt`, `hard_max_total_usdt`).

Decided:

- Capital is variable; the owner sizes and approves every trade; capital is managed from the moment a trade starts (§5.8). No automatic pacing or pausing.
- A Buy Low that expires without assignment ends the trade: capital and profit return to Available, with no automatic re-commit.

- Sell High floor is 5% APR; below it or when the strike is not listed, the cycle goes to `HODL` (§5.3).
- Every operation is confirmed by the owner (§5.6).
- No fixed IP; design per §13, with the proxy option kept open.

## 17. Backtesting module ("virtual" backtest)

### 17.1 Purpose and limit

Run the §5 strategy over a past period of BTCUSDT prices to compare configurations before risking money. The key question it answers: how much premium the cycle earns, and how long capital sits in BTC waiting to get back to the entry strike.

Binance publishes no historical Dual Investment APRs. Past product lists are therefore **synthetic**, and every result is an estimate that must display its assumptions and model error.

### 17.2 One strategy, two feeds

`strategy-core` receives everything through one interface:

```
MarketFeed { productList(leg, t), spotPrice(t), balances(t) }
```

- Live implementation (worker): the gateway.
- Backtest implementation: historical prices + APR source (§17.4) + simulated wallet.

### 17.3 Historical data

| Data | Source | Volume |
|---|---|---|
| BTCUSDT 1h candles | `GET /api/v3/klines` (public, max 1000 per call, weight 2) | 8,760 rows/year |
| BTCUSDT 1m candles, 07:30–08:00 UTC each day | same | 10,950 rows/year |
| Implied volatility (optional) | Deribit `public/get_volatility_index_data` (public; `currency=BTC`, `resolution=3600`; paginate with `continuation`) | 8,760 rows/year |

The gateway runs the backfill: idempotent, resumable, reports gaps. Default start 2020-01-01; volatility index only as far back as it exists.

Runs should include a long drawdown. Example: BTC took about 28 months (November 2021 → March 2024) to regain its previous high.

### 17.4 APR source for each simulated tick

Three sources, applied to both legs. `apr_source = AUTO` uses the first that applies.

| # | Source | When | Accuracy |
|---|---|---|---|
| 1 | `RECORDED` | The tick falls inside real `product_snapshot` coverage | Exact — real products, no model |
| 2 | `VOL_SCALED` | No snapshots for that date (default) | Adjusts to the volatility of each period |
| 3 | `STATIC_SURFACE` | Baseline, on request | Assumes today's APRs applied at all times |

Coverage of `RECORDED` grows every day the bot runs, so backtests get more exact with time without code changes.

**`STATIC_SURFACE`** — averaged observed APRs, one surface per leg:

- `distance = |strike − spot| / spot`.
- Bucket all snapshots by `duration` (days) and `distance` (0.5% steps). Cell APR = mean of the snapshots in the cell.
- Linear interpolation between cells. No extrapolation outside the observed range: that product is treated as not offered.

**`VOL_SCALED`** — option-pricing formula, then calibrated to snapshots:

- Buy Low: `P` = Black-Scholes put price; `r_fair = P / (K − P)`.
- Sell High: `C` = Black-Scholes call price; `r_fair = C / (S − C)`.
- Inputs: spot `S`, strike `K`, `T = days / 365`, volatility `σ`, rate 0. `apr_fair = r_fair × 365 / days`.
- `apr_model = apr_fair × k[leg][duration][distance]`.
- `k` (calibration) = median of `actual_apr / apr_fair` over the snapshots in each cell. It absorbs Binance's margin and the volatility skew.
- `σ` at tick `t`, per `vol_source`: `REALIZED_30D` (annualised standard deviation of 1h log returns over the previous 30 days; no external dependency) or `DVOL` (Deribit index / 100).

Why volatility matters — fair values, spot 100,000, 15 days, Buy Low strike that pays 35% APR:

| Volatility | Strike | Distance below spot | Model probability of exercise |
|---|---|---|---|
| 45% | 94,091 | 5.9% | 26.7% |
| 70% | 87,538 | 12.5% | 19.3% |

What the Sell High leg pays while waiting — fair values, entry strike 95,000, 15 days, volatility 60%:

| Spot | Entry strike is above spot by | Fair APR | Model probability of being sold |
|---|---|---|---|
| 90,000 | 5.6% | 67.3% | 30.7% |
| 85,000 | 11.8% | 31.0% | 16.5% |
| 80,000 | 18.8% | 11.5% | 7.0% |
| 70,000 | 35.7% | 0.7% | 0.5% |

**Calibration and error**

- Daily job in the backtester recalibrates both models, both legs and both `vol_source` options, and stores an `apr_model_version` each.
- Error = mean absolute percentage error between predicted and actual APR, measured on snapshots **not** used for that calibration (the most recent 20%).
- `AUTO` uses the `vol_source` with the lower error.
- Sensitivity: each run is repeated with modelled APRs × (1 − e) and × (1 + e), `e = max(error, 0.20)`, giving low / base / high results. `RECORDED` ticks are not scaled.

### 17.5 Synthetic product list

For each tick without snapshots, generate per leg:

- Durations: the set seen in snapshots (fallback: 1–30 days), each settling at 08:00 UTC.
- Strikes: grid below spot (Buy Low) or above spot (Sell High), step learned from snapshots (fallback: 500 USDT).
- Listing range: only up to the maximum distance from spot seen in snapshots for that leg (fallback: 25%). Beyond it the product does not exist — one of the two ways a cycle ends up in `HODL` (the other is APR under `sell_min_apr`).
- `apr` from §17.4, `canPurchase = true`, `minAmount` / `maxAmount` from the latest snapshot.

The strategy's own rules (§5.2, §5.3) then apply unchanged.

### 17.6 Simulation loop

Per tick (default every hour), in this order:

1. Settle positions due: price = mean of 1m closes 07:30–08:00 UTC; payout per §2.
2. Credit the simulated wallet at 14:00 UTC of the settle date (worst case of the real payout window) and move the cycle per §5.4.
3. Add `monthly_contribution_usdt` to Available on the 1st of each month.
4. Compute offers with `strategy-core` and apply the **simulated owner**:
   - Buy Low: start a cycle with the recommended product whenever Available covers the batch size and the last cycle was started more than `hours_between_new_batches` ago. Batch size = `batch_usdt`, scaled up by realized profit when `reinvest_profit = true`.
   - Flip: always approve.
   - Every approval happens `approval_delay_hours` after the offer and is re-validated then, as in §5.6 (0 = immediate).
5. Once per day, write a `backtest_equity` row.

Rules:

- Deterministic: same parameters + same model version = identical result. No randomness.
- No look-ahead: at tick `t` use only candles closed before `t`, including for volatility.

### 17.7 Run parameters

| Parameter | Default |
|---|---|
| `from` / `to` | required |
| `initial_usdt` | required |
| `batch_usdt` | required |
| `hours_between_new_batches` | 72 |
| `reinvest_profit` | true |
| strategy config | same JSON schema as §5.5 |
| `apr_source` | `AUTO` |
| `vol_source` | lowest error |
| `tick_interval` | 1h |
| `monthly_contribution_usdt` | 0 |
| `approval_delay_hours` | 0 |
| `sensitivity` | on |

Sweep: any strategy key may take a list of values; one run per combination, max 200 runs per sweep.

### 17.8 Results

- All §11 statistics.
- Headline: realized profit and annualised return on capital.
- Final value two ways: BTC at spot, and BTC at entry strike. Cycles still in BTC at the end are listed with their entry strike and unrealized result.
- Daily equity curve (both valuations) against the benchmarks: hold USDT; buy and hold BTC.
- Cycles: count by how they ended, average length, longest; share of capital-days in BTC; days with all managed capital in BTC.
- `HODL`: number of episodes, total and longest duration, split by reason (strike not listed / APR under the floor).
- Max drawdown with BTC valued at spot.
- Low / base / high from the sensitivity runs.
- Assumptions block: share of ticks `RECORDED` vs modelled, model version, model error, sample count.

### 17.9 Declared assumptions

1. Modelled APRs are estimates; only `RECORDED` ticks are real.
2. Calibration from recent snapshots (Binance's margin) is assumed valid for the past.
3. Every strike and duration inside the listing range was purchasable, with today's amount limits.
4. The Sell High listing range seen in recent snapshots is assumed valid for the past.
5. Settlement price approximated from 1m closes.
6. No failed subscriptions and no APR change between decision and subscribe.
7. The wallet has no other activity.
8. The simulated owner always approves the recommended trade with fixed batch sizes; real decisions will differ.

### 17.10 Isolation from live trading

- The backtester has no Binance key and cannot call `/api/decisions`, `/api/proposals` or `/api/cycles` (gateway rejects its token on those paths).
- Results are written only to `backtest_*` tables.
- "Use this config live" creates a draft in the Config screen; the owner must save it. Never applied automatically.

### 17.11 Acceptance

- The §2 full-cycle example is reproduced: 1,000 USDT → 0.01067772 BTC → 1,022.72 USDT.
- Put check: `S`=100,000, `K`=95,000, 15 days, `σ`=0.45 → `P` = 1,592.99 and `apr_fair` = 41.5%.
- Call check: `S`=85,000, `K`=95,000, 15 days, `σ`=0.60 → `C` = 1,067.75 and `apr_fair` = 31.0%.
- A scripted price path (fall below strike, stay just below, fall 30% further, recover) produces in order: assignment, at least two Sell Highs at the entry strike, `HODL`, Sell High again, exit to USDT.
- No simulated Sell High ever has a strike below its cycle's entry strike or an APR below `sell_min_apr`.
- Floor check: `S`=76,542, `K`=95,000, 15 days, `σ`=0.60 → `apr_fair` = 5.0%.
- Replay: a `RECORDED` backtest over a period the bot ran in `PAPER` yields the same positions as `PAPER`.
- With a single day of snapshots, both models run and the result shows error and sample count.
- A 2-year single run completes in under 60 s.
- Two executions of the same run are byte-identical.

## References

- Dual Investment REST API — https://developers.binance.com/en/docs/catalog/investment-and-services-dual-investment/api/rest-api/trade
- Product list — https://developers.binance.com/docs/dual_investment/market-data
- General info (limits, signing) — https://developers.binance.com/en/docs/products/advanced-earn/general-info
- Change log — https://developers.binance.com/docs/advanced_earn/change-log
- Product FAQ — https://www.binance.com/en/support/faq/what-is-binance-dual-investment-09911be9f5754c34806bd3ab4a427e0e
- Java connector — https://central.sonatype.com/artifact/io.github.binance/binance-dual-investment
- Spot klines — https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints
- Deribit volatility index — https://docs.deribit.com/api-reference/market-data/public-get_volatility_index_data
- API key rules (IP restriction, key types) — https://www.binance.com/en/support/faq/how-to-create-api-keys-on-binance-360002502072
- API key permission endpoint — https://developers.binance.com/docs/wallet/account/api-key-permission
- Error -2015 — https://dev.binance.vision/t/why-do-i-see-this-error-invalid-api-key-ip-or-permissions-for-action/93
