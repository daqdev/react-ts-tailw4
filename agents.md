# AGENTS.md — Alpaca CLI (`alpacahq/cli`)

Analysis of https://github.com/alpacahq/cli — a reference for AI agents, scripts,
and automation pipelines that want to use the Alpaca CLI.

## What it is

The Alpaca CLI (`alpaca`) is Alpaca's official command-line interface for its
trading platform. It lets you trade stocks, options, crypto, and crypto
perpetuals, manage your account, and pull market data directly from the
terminal.

- **Language:** Go (~99% of the codebase)
- **Status:** Alpha preview — commands and behavior may change without notice
- **Design philosophy:** "Built for Agents" — intended for scripts, automation
  pipelines, and AI agents rather than interactive human use. Commands execute
  immediately with **no confirmation prompts**.

## Installation

```bash
go install github.com/alpacahq/cli/cmd/alpaca@latest
# or
brew install alpacahq/tap/cli
```

## Authentication

Paper trading is the default; live trading requires explicit opt-in.

**Environment variables** (preferred for agents — avoids writing secrets to disk):

| Variable | Purpose |
|---|---|
| `ALPACA_API_KEY` / `ALPACA_SECRET_KEY` | API credentials (required together) |
| `ALPACA_LIVE_TRADE=true` | Enable live trading (defaults to paper) |
| `ALPACA_PROFILE` | Select a named profile |

**Profile-based login** (stored in `~/.config/alpaca/profiles/`):

```bash
alpaca profile login                              # OAuth, paper trading only
alpaca profile login --api-key                    # API key/secret, paper
alpaca profile login --api-key --live             # API key/secret, live
alpaca profile login --api-key --name prod --live # Named live profile
alpaca profile switch prod                        # Activate a profile
```

Note: OAuth is paper-only; live trading requires API keys.

## Command groups

| Group | Commands |
|---|---|
| Trading | `order`, `position`, `option`, `locate`, `clock`, `calendar` |
| Account & assets | `account`, `asset`, `watchlist`, `wallet`, `corporate-action` |
| Market data | `data` (stocks), `data crypto`, `data option`, `data forex`, `data index`, `data meta`, `data screener`, `data news` |
| Crypto perpetuals | `crypto-perp` |
| Utilities | `profile`, `api` (raw API access), `doctor`, `update`, `version`, `completion` |

## Output & formatting

JSON is the default output format. Structured errors go to **stderr**.

```bash
--csv          # CSV output
--jq '<expr>'  # Inline jq filtering
--quiet        # Suppress non-data output
--schema       # Print the response schema without making an API call
--timeout N    # Request timeout in seconds
```

## Example invocations

```bash
alpaca account get
alpaca order submit --symbol AAPL --side buy --qty 10 --type market
alpaca order list --status open
alpaca position list
alpaca position list --csv
alpaca position list --jq '.[0].symbol'
alpaca data bars --symbol AAPL --start 2025-01-01 --timeframe 1Day
alpaca clock
```

## Guidance for agents and automation

- **No confirmation prompts** — every command executes immediately. Treat order
  submission as irreversible and validate inputs before calling.
- **Idempotent retries:** pass `--client-order-id "$(uuidgen)"` so a retried
  submit doesn't create a duplicate order.
- **Preview first:** use `--dry-run` to validate an order without submitting it.
- **Raw API escape hatch:** pipe JSON payloads to any endpoint, e.g.
  `echo '{"symbol":"AAPL",...}' | alpaca api POST /v2/orders`.
- **Built-in resilience:** the CLI retries 429 and 5xx responses with
  exponential backoff (up to 3 attempts).
- **Exit codes:** `0` success, `1` API/general error, `2` authentication error.
- **Safety default:** stays in paper trading unless `--live` /
  `ALPACA_LIVE_TRADE=true` is set explicitly.
