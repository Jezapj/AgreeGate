# Deploy SearXNG on Railway (for Reddit & X previews)

AgreeGate uses your **self-hosted SearXNG** instance to find Reddit threads and X posts via web search (`site:reddit.com …`, `site:x.com …`). No Reddit or X API keys needed.

## 1. Create a SearXNG service on Railway

1. In [Railway](https://railway.app), **New Project → Deploy from Docker image**
2. Image: `searxng/searxng:latest`
3. Add a **public domain** (e.g. `searxng-production.up.railway.app`)

## 2. Environment variables (Railway → SearXNG service)

| Variable | Value |
|----------|--------|
| `SEARXNG_BASE_URL` | `https://YOUR-RAILWAY-DOMAIN` (must match public URL) |
| `INSTANCE_NAME` | `AgreeGate Search` (optional) |

Generate a secret key for production (optional but recommended):

```bash
openssl rand -hex 32
```

Set it as `SEARXNG_SECRET` if your image supports it.

## 3. Enable JSON API

SearXNG must allow `format=json`. The default Docker image includes JSON in `search.formats`. If previews fail, mount a custom `settings.yml` with:

```yaml
search:
  formats:
    - html
    - json
```

## 4. Wire AgreeGate

In AgreeGate's `.env.local` (local) or Vercel/Railway env (production):

```bash
# Single instance
SEARXNG_URL=https://YOUR-RAILWAY-DOMAIN

# Or a pool (recommended for production / paid tier)
SEARXNG_URLS=https://searxng-us.up.railway.app,https://searxng-eu.up.railway.app,https://searxng-ap.up.railway.app
```

AgreeGate rotates through the pool when an instance hits its per-minute budget or reports suspended upstream engines. Use **different Railway regions** per instance so each gets a separate upstream rate-limit bucket.

Restart AgreeGate. Reddit and X preview cards should appear on search.

## 5. Verify SearXNG works

```bash
curl "https://YOUR-RAILWAY-DOMAIN/search?q=site:reddit.com+how+to+swim&format=json"
```

You should get JSON with `results[]` containing `url`, `title`, and `content`.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Empty Reddit/X results | Check SearXNG logs; upstream engines may be rate-limited. Try enabling Google/Bing in SearXNG settings. |
| `Suspended: too many requests` in SearXNG | **Usually temporary** — Brave/DDG/Google pause your instance for minutes to hours, not forever. Restart the SearXNG container or wait for engines to recover. Reduce load with AgreeGate's `SEARXNG_MAX_REQUESTS_PER_MIN` (see `.env.example`). |
| `403` on `format=json` | Normal on many instances — AgreeGate automatically falls back to HTML parsing. To allow JSON, set `server.limiter: false` in SearXNG settings. |
| `403` from SearXNG | Ensure `SEARXNG_BASE_URL` matches your public Railway URL exactly. |
| Slow searches | SearXNG aggregates multiple engines; 3–8s is normal. AgreeGate caches results for 10 minutes. |
| AgreeGate can't reach SearXNG | If AgreeGate is on Vercel, SearXNG must be publicly reachable (Railway public domain). |

## Rate limits & protecting SearXNG

SearXNG forwards queries to third-party engines (Brave, DuckDuckGo, Google CSE, etc.). Those engines **suspend** an instance when it sends too many requests — this is almost always **temporary** (minutes to a few hours). It does not permanently brick your Railway deployment, but repeated hammering can lead to longer blocks or IP flags.

AgreeGate helps by:

- **Instance pool** — `SEARXNG_URLS` (comma-separated) with automatic failover when an instance is suspended or over budget.
- **Per-instance budget** — `SEARXNG_MAX_REQUESTS_PER_MIN` (default `10`) applies to each host separately.
- **Per-query preview cache** — Reddit/X previews are cached for 30 minutes (`SEARXNG_PREVIEW_CACHE_MS`), so repeat searches do not hit SearXNG again.
- **Two calls per search max** — one for Reddit, one for X (merged `x.com` + `twitter.com` query).
- **Cooldown** — `SEARXNG_INSTANCE_COOLDOWN_MS` (default 30 min) skips unhealthy instances after engine suspension.

### How many instances?

| Count | Use case |
|-------|----------|
| **1** | Dev / low traffic |
| **2** | Basic failover |
| **3** | **Recommended** for a paid tier — e.g. US + EU + AP regions |
| **4–5** | High traffic only; diminishing returns beyond that for most apps |

Example `.env.local`:

```bash
SEARXNG_URLS=https://searxng-us.up.railway.app,https://searxng-eu.up.railway.app,https://searxng-ap.up.railway.app
SEARXNG_MAX_REQUESTS_PER_MIN=8
SEARXNG_PREVIEW_CACHE_MS=3600000
REDDIT_PREVIEW_LIMIT=5
X_PREVIEW_LIMIT=4
```

If engines are suspended right now, wait or restart SearXNG on Railway, then search again with caching/throttling in place.

## Cost

- **SearXNG on Railway Hobby**: uses your existing hobby plan resources
- **No per-query API fees** — unlimited searches subject to upstream engine limits
- AgreeGate makes **2 SearXNG calls per user search** (Reddit + X), subject to `SEARXNG_MAX_REQUESTS_PER_MIN`
