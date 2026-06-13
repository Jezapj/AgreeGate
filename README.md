# AgreeGate

**A search engine for real human answers.** No sponsored results. No AI summaries. No bots — just what actual people said.

You ask a question; AgreeGate searches live discussions and returns genuine human responses, linking back to the original threads.

- **Hacker News** — works out of the box, no setup. Free public API; returns real human comments.
- **Reddit** — the primary source. Finds the most relevant threads, then surfaces their top human comments. Reddit blocks anonymous access, so this needs free API credentials (2-minute setup below).
- **X / Twitter** — secondary and *off by default*. X carries heavy bot noise, so it's only included when you provide an API token, and posts are filtered through bot/spam heuristics.

## Principles

- ✅ Only real human responses
- ✅ Every answer links back to its source
- 🚫 No sponsored or promoted content
- 🚫 No AI-generated summaries
- 🚫 No bot posts (filtered out aggressively)

## Tech

- [Next.js 14](https://nextjs.org/) (App Router) + TypeScript
- React 18, no UI framework — custom neon theme (black / lime-green / white)
- Live data via the public Reddit JSON API and the X API v2 (optional)

## Getting started

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). Hacker News results work immediately.

### Enabling Reddit (recommended — the primary source)

Reddit blocks anonymous API access, so you need free credentials:

1. Go to [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) → **create another app...**
2. Choose type **script**, set redirect URI to `http://localhost:3000`.
3. Copy `.env.example` to `.env.local` and set the client id (shown under the app name) and secret:

```bash
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
```

4. Restart `npm run dev`. Reddit results now appear alongside Hacker News.

### Enabling X (optional)

X is disabled unless you provide a Bearer Token. In `.env.local` set:

```bash
X_BEARER_TOKEN=your_token_here
```

## Deploying (Vercel)

AgreeGate is a standard Next.js app and deploys to [Vercel](https://vercel.com) with zero config.

1. Push this folder to a Git repo (GitHub/GitLab/Bitbucket).
2. In Vercel, **Add New → Project** and import the repo (framework auto-detects as Next.js).
3. Add environment variables in **Project → Settings → Environment Variables** (do **not** commit `.env.local`):
   - `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` — for Reddit results
   - `X_BEARER_TOKEN` — optional, for X results
4. Deploy. That's it.

Or from the CLI:

```bash
npm i -g vercel
vercel            # preview deploy
vercel --prod     # production deploy
```

### Production notes

- **No localhost is hardcoded.** Reddit uses application-only OAuth (`client_credentials`), so the Reddit app's redirect URI is never used — your credentials work on any domain.
- **Caching:** search responses are cached in-memory (10 min) and via CDN headers (`s-maxage=600, stale-while-revalidate`), so repeated/popular queries don't re-hit the source APIs.
- **Rate limiting:** the `/api/search` endpoint is rate-limited per IP (20 req/min, best-effort in-memory). For a strict global limit across instances, swap `src/lib/rateLimit.ts` for Upstash/Vercel KV.
- **Reddit API limits:** application-only OAuth allows ~100 requests/min. Each search makes several Reddit calls, so caching is what keeps you under the cap. Heavy commercial traffic should review Reddit's Data API terms.

## How it works

1. `GET /api/search?q=...` runs Reddit and X lookups in parallel.
2. **Reddit:** searches threads by relevance, then fetches each thread's top comments, dropping bots (`AutoModerator`, `*bot`), deleted/removed content, and low-effort one-liners.
3. **X:** queries recent tweets (no retweets/replies), then scores each for bot/spam signals (link/hashtag spam, tiny accounts, giveaway language) and keeps only clean, human-looking posts.
4. Results are returned with source attribution and ranked by engagement. Reddit always comes first.

## Project structure

```
src/
  app/
    layout.tsx          # metadata, theme color, favicon
    page.tsx            # home + results UI (client)
    page.module.css     # the AgreeGate theme
    globals.css         # base styles / palette tokens
    api/search/route.ts # combined search endpoint
  components/
    SearchBar.tsx
    ResultCard.tsx
    icons.tsx
  lib/
    reddit.ts           # Reddit source + bot filtering
    x.ts                # X source + bot heuristics
    types.ts
    format.ts
    fetchUtils.ts
public/
  logo-green.png / logo-dark.png / icon.png
```

## Notes

- Reddit's public endpoints are rate-limited per IP. If a search returns nothing, wait a moment and retry.
- This is an MVP; nothing is persisted and there's no auth.
