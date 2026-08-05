# AgreeGate

**A search engine for real human answers.** No sponsored results. No AI summaries. No bots — just what actual people said.

You ask a question; AgreeGate searches live discussions and returns genuine human responses, linking back to the originals. It works across **all topics** (cooking, travel, finance, fitness, DIY, gaming, tech…), not just tech.

**Free, zero-setup sources (on by default):**

- **Bluesky** — broad, all-topics social posts from real people via the open AppView API.
- **Lemmy** — federated Reddit alternative; free API with real human threads + comments.
- **Stack Exchange** — Q&A across cooking, travel, finance, fitness, DIY, gaming, tech, and more.
- **Hacker News** — free public API; real human comments.

**Reddit & X (link previews via SearXNG):**

- **Reddit** and **X** show **Google-style link previews** (title, snippet, click-through) — not inline API answers.
- Powered by your **self-hosted [SearXNG](https://github.com/searxng/searxng)** instance (free on Railway Hobby).
- Set `SEARXNG_URL` in env — **no Reddit or X API keys needed**.
- See **[docs/searxng-railway.md](docs/searxng-railway.md)** for Railway deployment.

> **Recall:** natural-language questions are keywordized for Bluesky/Lemmy
> (e.g. "how to clean matted hair" → "clean matted hair").

## Principles

- ✅ Only real human responses
- ✅ Every answer links back to its source
- 🚫 No sponsored or promoted content
- 🚫 No AI-generated summaries
- 🚫 No bot posts (filtered out aggressively)

## Tech

- [Next.js 14](https://nextjs.org/) (App Router) + TypeScript
- React 18, no UI framework — custom neon theme (black / lime-green / white)
- Live data from Bluesky, Lemmy, Stack Exchange, HN, plus Reddit/X via SearXNG

## Getting started

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). Bluesky, Lemmy, Stack Exchange, and Hacker News work with no setup.

### Reddit & X previews (SearXNG on Railway)

1. Deploy SearXNG on Railway — see **[docs/searxng-railway.md](docs/searxng-railway.md)**
2. Add to `.env.local`:

```bash
SEARXNG_URL=https://your-searxng.up.railway.app
```

3. Restart `npm run dev` — Reddit and X preview cards appear on search.

### Optional: higher Stack Exchange quota

Register a free key at [stackapps.com](https://stackapps.com/apps/oauth/register) and set `STACKEXCHANGE_KEY`.

## Deploying (Vercel)

AgreeGate is a standard Next.js app and deploys to [Vercel](https://vercel.com) with zero config.

1. Push this folder to a Git repo (GitHub/GitLab/Bitbucket).
2. In Vercel, **Add New → Project** and import the repo (framework auto-detects as Next.js).
3. Add environment variables — at minimum for Reddit/X previews:

```bash
SEARXNG_URL=https://your-searxng.up.railway.app
```

Optional: `STACKEXCHANGE_KEY` for higher SE quota.

Or from the CLI:

```bash
npm i -g vercel
vercel            # preview deploy
vercel --prod     # production deploy
```

### Production notes

- **SearXNG** must be publicly reachable from Vercel (Railway public domain works).
- **Caching:** search responses are cached in-memory (10 min) and via CDN headers (`s-maxage=600, stale-while-revalidate`).
- **Rate limiting:** `/api/search` is limited to 20 req/min per IP (best-effort in-memory).

## How it works

1. `GET /api/search?q=...` runs all sources in parallel.
2. **Reddit / X:** SearXNG runs `site:reddit.com` and `site:x.com` searches; AgreeGate shows title + snippet preview cards that link out.
3. **Bluesky / Lemmy / Stack Exchange / HN:** inline human answers (unchanged).

## Project structure

```
src/
  app/
    layout.tsx          # metadata, theme color, favicon
    page.tsx            # home + results UI (client)
    page.module.css     # the AgreeGate theme
    globals.css         # base styles / palette tokens
    api/search/route.ts # combined search endpoint
  lib/
    searxng.ts        # SearXNG JSON client
    previews.ts       # Reddit & X link previews via SearXNG
    bluesky.ts  lemmy.ts  stackexchange.ts  hn.ts
public/
  logo-green.png / logo-dark.png / icon.png
```

## Notes

- Free APIs are rate-limited per IP. If a search returns little, wait a moment and retry, or add a `STACKEXCHANGE_KEY`.
- This is an MVP; nothing is persisted (aside from the optional Reddit session cookie).
