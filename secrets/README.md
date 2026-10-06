# secrets/

Everything in this folder except this file is git-ignored.

| File | Read by | Content |
|---|---|---|
| `binance_private_key.pem` | gateway only, as a Docker secret | Private half of the self-generated Ed25519 API key (SPEC §13) |

Until M0 there is no key yet; create an empty file so Compose can start:

```bash
touch secrets/binance_private_key.pem
```

With the real key, make it readable only by the gateway's container user (uid 10001):

```bash
sudo chown 10001 secrets/binance_private_key.pem && chmod 400 secrets/binance_private_key.pem
```
