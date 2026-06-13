import { Answer, SearchResult, SourceStatus } from "./types";
import { USER_AGENT, decodeEntities, fetchJson } from "./fetchUtils";

const SETUP_NOTE =
  "Reddit needs free API credentials (Reddit blocks anonymous access). Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET to .env.local — see the README.";

let cachedToken: { token: string; expires: number } | null = null;

/** Application-only OAuth token for a Reddit "script" app. */
async function getRedditToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (cachedToken && cachedToken.expires > Date.now() + 15_000) {
    return cachedToken.token;
  }
  try {
    const auth = Buffer.from(`${id}:${secret}`).toString("base64");
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = {
      token: json.access_token,
      expires: Date.now() + json.expires_in * 1000,
    };
    return cachedToken.token;
  } catch {
    return null;
  }
}

const BOT_AUTHORS = new Set([
  "automoderator",
  "[deleted]",
  "savevideo",
  "remindmebot",
  "sneakpeekbot",
  "wikitextbot",
  "totesmessenger",
  "stabbot",
  "gifv-bot",
  "imguralbumbot",
]);

interface RedditListing {
  data: {
    children: Array<{ kind: string; data: any }>;
  };
}

function isBotOrEmpty(author: string, body: string): boolean {
  const a = (author || "").toLowerCase();
  if (BOT_AUTHORS.has(a)) return true;
  if (a.endsWith("bot") || a.endsWith("-bot") || a.endsWith("_bot")) return true;
  const b = (body || "").trim();
  if (!b || b === "[removed]" || b === "[deleted]") return true;
  // Drop low-effort one-liners that are pure links or "this".
  if (b.length < 12) return true;
  return false;
}

function clamp(text: string, max = 900): string {
  const t = decodeEntities(text).trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

async function fetchTopComments(
  permalink: string,
  limit: number,
  base: string,
  headers: Record<string, string>
): Promise<Answer[]> {
  try {
    const url = `${base}${permalink}.json?limit=${limit + 4}&sort=top&depth=1&raw_json=1`;
    const json = await fetchJson<RedditListing[]>(url, { timeoutMs: 7000, headers });
    const commentsListing = json?.[1];
    if (!commentsListing?.data?.children) return [];

    const answers: Answer[] = [];
    for (const child of commentsListing.data.children) {
      if (child.kind !== "t1") continue;
      const d = child.data;
      const author = d.author ?? "";
      const body = d.body ?? "";
      if (isBotOrEmpty(author, body)) continue;
      if (d.stickied) continue;
      answers.push({
        id: d.id,
        author,
        body: clamp(body),
        score: typeof d.score === "number" ? d.score : 0,
        url: `https://www.reddit.com${d.permalink ?? permalink}`,
        createdUtc: d.created_utc ?? 0,
      });
      if (answers.length >= limit) break;
    }
    return answers;
  } catch {
    return [];
  }
}

export async function searchReddit(
  query: string,
  opts: { posts?: number; answersPerPost?: number; userToken?: string } = {}
): Promise<{ results: SearchResult[]; status: SourceStatus }> {
  const { posts = 6, answersPerPost = 3, userToken } = opts;

  // Prefer the signed-in user's token (their own per-user rate limit);
  // otherwise fall back to this app's application-only token.
  const token = userToken ?? (await getRedditToken());
  const base = token ? "https://oauth.reddit.com" : "https://www.reddit.com";
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  try {
    const url = `${base}/search.json?q=${encodeURIComponent(
      query
    )}&sort=relevance&t=all&limit=25&type=link&raw_json=1`;
    const listing = await fetchJson<RedditListing>(url, {
      timeoutMs: 8000,
      headers,
    });

    const candidates = (listing?.data?.children ?? [])
      .filter((c) => c.kind === "t3")
      .map((c) => c.data)
      .filter((d) => !d.stickied && !d.over_18 && (d.num_comments ?? 0) > 0)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, posts);

    const withComments = await Promise.all(
      candidates.map(async (d) => {
        const answers = await fetchTopComments(
          d.permalink,
          answersPerPost,
          base,
          headers
        );
        const result: SearchResult = {
          id: `reddit_${d.id}`,
          source: "reddit",
          title: decodeEntities(d.title ?? ""),
          subtitle: `r/${d.subreddit}`,
          url: `https://www.reddit.com${d.permalink}`,
          score: d.score ?? 0,
          numComments: d.num_comments ?? 0,
          createdUtc: d.created_utc ?? 0,
          selfText: d.selftext ? clamp(d.selftext, 400) : undefined,
          answers,
        };
        return result;
      })
    );

    // Prefer threads that actually surfaced human answers.
    const results = withComments
      .filter((r) => r.answers.length > 0)
      .sort((a, b) => b.score - a.score);

    return {
      results,
      status: { ok: true, count: results.length },
    };
  } catch (err) {
    return {
      results: [],
      status: {
        ok: false,
        count: 0,
        note: token
          ? "Reddit could not be reached right now (rate limit or network). Try again in a moment."
          : SETUP_NOTE,
      },
    };
  }
}
