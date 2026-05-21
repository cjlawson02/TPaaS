# TPaaS — Trolley Problem as a Service

Random approved trolley-problem memes, served from the Cloudflare edge with sub-millisecond Worker execution on the hot path.

## Architecture

Single Worker (`tpaas`) on `tpaas.chrislawson.dev`:

| Area | Routes |
|------|--------|
| Gallery / API | `GET /`, `/gallery`, `/random`, `/{uuid}` |
| Submit / review | `GET /request`, `POST /submit`, `/discord/interactions`, `/preview/pending/{id}` |

Storage: **R2** — `tpaas-assets` (public, approved only) and `tpaas-pending` (private). **KV** for catalog, pending metadata, and dedup index.

## Quick start (local)

```bash
npm install
npm run dev
```

http://localhost:8787 — gallery at `/`, upload at `/request`

## Production

See **[docs/PRODUCTION.md](docs/PRODUCTION.md)** for the full checklist (Cloudflare resources, DNS, GitHub secrets, Discord).

**GitHub Actions**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| [CI/CD](.github/workflows/ci.yml) | PR + push to `main`, manual | Test; deploy + smoke on `main` only |

Required repository secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_REVIEW_USER_IDS`.

Discord application ID and review channel ID are Worker vars in `wrangler.jsonc`.

## Deploy (manual)

### 1. Create Cloudflare resources

```bash
wrangler kv namespace create TPAAS_KV
wrangler r2 bucket create tpaas-assets
wrangler r2 bucket create tpaas-pending
```

Update `REPLACE_WITH_KV_NAMESPACE_ID` in `wrangler.jsonc`.

### 2. URLs

| Service | URL |
|---------|-----|
| App | `https://tpaas.chrislawson.dev` |
| Assets (R2) | `https://assets.tpaas.chrislawson.dev` |

Discord Interactions Endpoint: `https://tpaas.chrislawson.dev/discord/interactions`

### 3. Discord bot

```bash
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_BOT_TOKEN
```

Set `DISCORD_APPLICATION_ID` and `DISCORD_REVIEW_CHANNEL_ID` in `wrangler.jsonc`. Set `DISCORD_REVIEW_USER_IDS` as a repository secret (or `wrangler secret put`).

### 4. Deploy

```bash
npm run deploy
```

## Request a new meme

**Browser:** https://tpaas.chrislawson.dev/request

**API:**

```bash
curl -X POST https://tpaas.chrislawson.dev/submit -F "image=@meme.jpg"
```

Returns `202 { "id": "...", "status": "pending" }`. Duplicate byte-identical images are rejected (`409`). You get a Discord review message with Approve / Reject; approved memes appear on `GET /random`.

**Review is Discord-only.** Approve/reject has no public HTTP API. Discord requests are verified (Ed25519 + timestamp), and only allowlisted user IDs in `DISCORD_REVIEW_USER_IDS` can act in `DISCORD_REVIEW_CHANNEL_ID`.

## API reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | HTML grid of all approved memes |
| GET | `/gallery` | Alias for `/` |
| GET | `/random` | Random approved meme (URL stays `/random`) |
| GET | `/{uuid}` | 302 to specific approved meme |
| GET | `/request` | HTML upload page |
| POST | `/submit` | `multipart/form-data` field `image` (JPEG/PNG, max 5MB) → `202`, or `409` if duplicate |
| POST | `/discord/interactions` | Discord webhook |
| GET | `/preview/pending/{id}` | Pending image (Discord embeds) |
| GET | `/health` | Liveness |

## Rate limiting

| Scope | Limit |
|-------|-------|
| `/`, `/gallery`, `/random`, `/{id}` | 300 / minute |
| `POST /submit` | 10 / minute |
| `GET /preview/pending/{id}` | 120 / minute |
| `POST /discord/interactions` | 60 / minute |

## Development

```bash
npm test
npm run test:integration
npm run typecheck
npm run dev
```

## License

MIT
