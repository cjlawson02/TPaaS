# Production deployment checklist

One-time setup, then pushes to `main` deploy via GitHub Actions.

## 1. Cloudflare resources

```bash
npm install
wrangler kv namespace create TPAAS_KV
wrangler r2 bucket create tpaas-assets
wrangler r2 bucket create tpaas-pending
```

Replace placeholders in [`wrangler.jsonc`](../wrangler.jsonc):

| Placeholder | File |
|-------------|------|
| `REPLACE_WITH_KV_NAMESPACE_ID` | `wrangler.jsonc` |
| `REPLACE_WITH_DISCORD_APPLICATION_ID` | `wrangler.jsonc` |
| `REPLACE_WITH_DISCORD_REVIEW_CHANNEL_ID` | `wrangler.jsonc` |

`DISCORD_REVIEW_USER_IDS` is a **GitHub secret** (not in wrangler.jsonc).

### DNS (zone: `chrislawson.dev`)

| Hostname | Points to |
|----------|-----------|
| `tpaas.chrislawson.dev` | `tpaas` worker |
| `assets.tpaas.chrislawson.dev` | R2 public custom domain on **`tpaas-assets` only** |

**Do not** attach a public domain to `tpaas-pending`. Unreleased uploads are served only via `/preview/pending/{id}` on the worker.

Remove any old `submit.tpaas` DNS / custom domain if it was configured previously.

## 2. GitHub repository secrets

`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_REVIEW_USER_IDS`

(`DISCORD_REVIEW_CHANNEL_ID` and `DISCORD_APPLICATION_ID` are Worker vars in `wrangler.jsonc`.)

## 3. Discord

**Interactions Endpoint URL:** `https://tpaas.chrislawson.dev/discord/interactions`

Approve/reject is **only** via Discord button interactions (signature-verified). No other route can change the catalog.

## 4. Deploy

Push to `main` runs tests then deploys in one workflow (or use manual **workflow_dispatch** on `main`).

PRs run tests only. Deploy gates on placeholder checks, then smoke-tests `/health`.

## 5. Go live

Open https://tpaas.chrislawson.dev/request and upload a meme, or:

```bash
curl -X POST https://tpaas.chrislawson.dev/submit -F "image=@meme.jpg"
```

Approve in Discord → https://tpaas.chrislawson.dev/random

## Verify

```bash
curl -s https://tpaas.chrislawson.dev/health
```

## Architecture notes

- **Catalog** is KV-only: one key per approved meme (`cat:{uuid}.{ext}`). Approves write entry then version sequentially.
- **Pending images** live in private bucket `tpaas-pending`. **Approved images** live in `tpaas-assets` under `approved/`.
- **Dedup** uses claim-then-verify before upload. Stale pending dedup (orphaned after partial failure) is cleared on resubmit.
- **API cache** re-reads `cat:version` without edge cache TTL on every in-isolate cache hit.
- **Discord approve** is idempotent; re-clicks discard orphaned pending state but preserve approved dedup.
