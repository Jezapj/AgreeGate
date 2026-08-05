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
SEARXNG_URL=https://YOUR-RAILWAY-DOMAIN
```

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
| `403` on `format=json` | Normal on many instances — AgreeGate automatically falls back to HTML parsing. To allow JSON, set `server.limiter: false` in SearXNG settings. |
| `403` from SearXNG | Ensure `SEARXNG_BASE_URL` matches your public Railway URL exactly. |
| Slow searches | SearXNG aggregates multiple engines; 3–8s is normal. AgreeGate caches results for 10 minutes. |
| AgreeGate can't reach SearXNG | If AgreeGate is on Vercel, SearXNG must be publicly reachable (Railway public domain). |

## Cost

- **SearXNG on Railway Hobby**: uses your existing hobby plan resources
- **No per-query API fees** — unlimited searches subject to upstream engine limits
- AgreeGate makes ~2 SearXNG calls per user search (Reddit + X)
