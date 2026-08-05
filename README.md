# AgreeGate

**A search engine for real human answers.** No sponsored results. No AI summaries. No bots — just what actual people said.

You ask a question; AgreeGate searches live discussions and returns genuine human responses, linking back to the originals. It works across **all topics** (cooking, travel, finance, fitness, DIY, gaming, tech…), not just tech.

**Free, zero-setup sources (on by default):**

- **Bluesky** — broad, all-topics social posts from real people via the open, no-auth AppView API. The "what are people actually saying" source, with far less bot spam than X.
- **Lemmy** — the open, federated Reddit alternative. Free, no-auth API; real human threads + top comments across communities.
- **Stack Exchange** — real human Q&A across a diverse slice of the network (Stack Overflow, Seasoned Advice/cooking, Travel, Personal Finance, Fitness, Home Improvement, Arqade/gaming, Super User). Free API, no approval.
- **Hacker News** — free public API; real human comments.

> **Recall:** natural-language questions are reduced to keywords before hitting
> keyword-matching APIs (e.g. "how to clean matted hair" → "clean matted hair"),
> which dramatically improves results for non-tech, everyday questions.

**Not supported (and why):**

- **Reddit / Quora** — closed their data: Reddit requires approved API access; Quora has no API and blocks crawling (ToS-prohibited). Reddit is wired up for if you get approved credentials.
- **Mastodon** — its full-text post search requires authentication (public unauthenticated search returns nothing), so it isn't viable as a free, zero-setup source.

**Optional sources (off unless configured):**

- **Reddit** — Reddit closed self-serve API signup in late 2025 (the "Responsible Builder Policy"); new access requires approval. If you have approved or legacy credentials, AgreeGate lights up Reddit results plus an optional **Connect Reddit** login (per-user rate limits). The integration is built and ready.
- **X / Twitter** — X's API now requires a **paid plan** to search, and it's the most bot-heavy source, so it's off by default. Add a Bearer Token to enable it (bot-filtered).

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

Then open [http://localhost:3000](http://localhost:3000). Bluesky, Stack Exchange, and Hacker News results work immediately — no keys required.

### Optional: higher Stack Exchange quota

Stack Exchange works with no key (~300 requests/day per IP). For more, register a
free, no-approval key at [stackapps.com](https://stackapps.com/apps/oauth/register)
and set `STACKEXCHANGE_KEY` in `.env.local` (raises the quota to ~10k/day).

### Optional: enabling Reddit

Reddit closed self-serve API signup in late 2025, so new credentials require
approval via Reddit's Developer Support form. If you have approved (or legacy
pre-2025) credentials, add them to `.env.local`:

```bash
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
SESSION_SECRET=run `openssl rand -hex 32` and paste here
```

Restart `npm run dev` and Reddit results (plus the **Connect Reddit** button) appear.

#### "Connect Reddit" (per-user rate limits)

With credentials set, a **Connect Reddit** button appears. Anonymous search uses
the app's shared 100 req/min budget; signing in lets each user search on their
**own** 100 req/min budget — the cleanest way to scale.

- It uses Reddit's Authorization Code OAuth flow (scopes `identity read`), stores
  the token in an **encrypted, httpOnly cookie**, and auto-refreshes it.
- Reddit allows **one redirect URI per app**, so it must match the environment.
  Locally that's `http://localhost:3000/api/auth/reddit/callback`; in production
  set it to `https://your-domain/api/auth/reddit/callback` (update the Reddit app,
  or use a separate app per environment). You can override detection with
  `REDDIT_REDIRECT_URI`.

### Enabling X (optional)

X is disabled unless you provide a Bearer Token. In `.env.local` set:

```bash
X_BEARER_TOKEN=your_token_here
```

## Deploying (Vercel)

AgreeGate is a standard Next.js app and deploys to [Vercel](https://vercel.com) with zero config.

1. Push this folder to a Git repo (GitHub/GitLab/Bitbucket).
2. In Vercel, **Add New → Project** and import the repo (framework auto-detects as Next.js).
3. Add environment variables in **Project → Settings → Environment Variables** (do **not** commit `.env.local`) — all optional, since the default sources need none:
   - `STACKEXCHANGE_KEY` — higher Stack Exchange quota
   - `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `SESSION_SECRET` — for Reddit results + login
   - `X_BEARER_TOKEN` — for X results (paid X plan required)
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

1. `GET /api/search?q=...` runs all enabled sources in parallel. Natural-language queries are reduced to keywords for keyword-matching APIs (Bluesky, Lemmy).
2. **Bluesky:** searches public posts via the open AppView, then scores each for bot/spam signals (link/hashtag spam, giveaway language, bot-like handles, too-short text) and keeps only clean, human-looking posts.
3. **Lemmy:** searches posts on a federated instance, filters to query-relevant ones, and fetches each thread's top human comments (skipping bot accounts / deleted content).
4. **Stack Exchange:** searches a diverse set of network sites in parallel, picks the top-scored answered questions, and fetches their top-voted human answers.
5. **Hacker News:** searches stories (with `optionalWords` for recall), then pulls each story's top human comments.
6. **Reddit / X (optional):** when credentials are present, Reddit threads + top comments and bot-filtered X posts are added.
7. Results are returned with source attribution and ranked by engagement. Bot/deleted/low-effort content is dropped throughout.

## Project structure

```
src/
  app/
    layout.tsx          # metadata, theme color, favicon
    page.tsx            # home + results UI (client)
    page.module.css     # the AgreeGate theme
    globals.css         # base styles / palette tokens
    api/search/route.ts # combined search endpoint
    api/auth/...        # optional Reddit OAuth (login/callback/logout/session)
  components/
    SearchBar.tsx  ResultCard.tsx  ConnectReddit.tsx  icons.tsx
  lib/
    bluesky.ts          # Bluesky source + bot heuristics
    lemmy.ts            # Lemmy source (federated Reddit alt)
    stackexchange.ts    # Stack Exchange multi-site source
    hn.ts               # Hacker News source
    reddit.ts           # Reddit source (optional) + bot filtering
    x.ts                # X source (optional) + bot heuristics
    query.ts            # keyword extraction / relevance (recall)
    cache.ts  rateLimit.ts  crypto.ts  redditAuth.ts
    types.ts  format.ts  fetchUtils.ts
public/
  logo-green.png / logo-dark.png / icon.png
```

## Notes

- Free APIs are rate-limited per IP. If a search returns little, wait a moment and retry, or add a `STACKEXCHANGE_KEY`.
- This is an MVP; nothing is persisted (aside from the optional Reddit session cookie).
