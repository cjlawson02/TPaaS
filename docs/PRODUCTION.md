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

After creating the bucket, allow cross-origin reads so embedders (e.g. tierlist.chrislawson.dev) can export images:

```bash
npm run r2:cors
```

Config: [`r2-cors/tpaas-assets.json`](../r2-cors/tpaas-assets.json) — public GET on approved assets only; safe because the bucket holds no private data.

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

## Seed import corpus

After deploying attribution support:

```bash
npm run import:metadata   # builds data/import/metadata.jsonl (~10 min)
npm run import:export     # builds data/seed/ for dashboard upload
```

### Dashboard upload (recommended)

1. **R2** — bucket `tpaas-assets` → upload `data/seed/approved/*` under prefix **`approved/`**
2. **KV** — namespace `TPAAS_KV` → bulk import `data/seed/kv-bulk.json`

See `data/seed/README.txt` after export.

### Wrangler CLI (alternative)

Must pass `--remote` or wrangler writes to local dev storage only:

```bash
npm run import:seed -- --dry-run
npm run import:seed
```

The seed script adds `--remote` automatically. Seeding skips content already in KV dedup index.

## Verify

```bash
curl -s https://tpaas.chrislawson.dev/health
```

## Architecture notes

- **Catalog** is KV-only: denormalized manifest at `cat:manifest` (one read for the full catalog) plus per-entry keys `cat:{uuid}.{ext}` for idempotency. Legacy deployments auto-migrate from list+get on first read. Approves update manifest, entry key, and version together.
- **Pending images** live in private bucket `tpaas-pending`. **Approved images** live in `tpaas-assets` under `approved/`.
- **Dedup** uses claim-then-verify before upload. Stale pending dedup (orphaned after partial failure) is cleared on resubmit.
- **API cache** uses in-isolate catalog memory (60s TTL, zero KV reads while warm) plus Workers Cache API for `/catalog.json` and gallery HTML (checked before KV). Approvals purge both caches so new entries appear immediately.
- **Discord approve** is idempotent; re-clicks discard orphaned pending state but preserve approved dedup.
