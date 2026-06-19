import { SearchResult, SourceStatus } from "./types";
import { fetchJson } from "./fetchUtils";

interface XUser {
  id: string;
  username: string;
  name: string;
  verified?: boolean;
  public_metrics?: { followers_count: number; tweet_count: number };
}

interface XTweet {
  id: string;
  text: string;
  author_id: string;
  created_at?: string;
  public_metrics?: {
    like_count: number;
    reply_count: number;
    retweet_count: number;
    quote_count: number;
  };
}

interface XResponse {
  data?: XTweet[];
  includes?: { users?: XUser[] };
}

/**
 * Heuristic bot/spam score. Higher = more likely a bot or low-value post.
 * X has a high bot ratio, so we filter aggressively and rank conservatively.
 */
function botSignals(tweet: XTweet, user?: XUser): number {
  let score = 0;
  const text = tweet.text || "";
  const links = (text.match(/https?:\/\//g) || []).length;
  const hashtags = (text.match(/#\w+/g) || []).length;
  const mentions = (text.match(/@\w+/g) || []).length;
  const followers = user?.public_metrics?.followers_count ?? 0;
  const tweets = user?.public_metrics?.tweet_count ?? 0;

  if (links >= 2) score += 2;
  if (hashtags >= 4) score += 2;
  if (mentions >= 4) score += 1;
  if (followers < 50) score += 2;
  if (tweets > 80000) score += 1; // extremely high volume = likely automated
  if (/\b(giveaway|airdrop|free crypto|dm me|click the link|promo code)\b/i.test(text))
    score += 4;
  if (user?.verified) score -= 1;
  if (followers > 5000) score -= 1;
  return score;
}

export async function searchX(
  query: string,
  opts: { limit?: number } = {}
): Promise<{ results: SearchResult[]; status: SourceStatus }> {
  const { limit = 6 } = opts;
  const token = process.env.X_BEARER_TOKEN;

  if (!token) {
    return {
      results: [],
      status: {
        ok: false,
        count: 0,
        note:
          "X is optional and currently off — its API now requires a paid plan to search. Add an X_BEARER_TOKEN to enable it.",
      },
    };
  }

  try {
    // Exclude retweets/replies/links-only and stick to one language to cut bot noise.
    const q = `${query} -is:retweet -is:reply lang:en`;
    const url =
      `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(q)}` +
      `&max_results=${Math.min(Math.max(limit * 3, 10), 50)}` +
      `&tweet.fields=public_metrics,created_at` +
      `&expansions=author_id&user.fields=username,name,verified,public_metrics`;

    const json = await fetchJson<XResponse>(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs: 8000,
    });

    const users = new Map<string, XUser>();
    for (const u of json.includes?.users ?? []) users.set(u.id, u);

    const results: SearchResult[] = (json.data ?? [])
      .map((t) => ({ t, u: users.get(t.author_id), bot: botSignals(t, users.get(t.author_id)) }))
      .filter((x) => x.bot <= 1)
      .map(({ t, u }) => {
        const likes = t.public_metrics?.like_count ?? 0;
        const replies = t.public_metrics?.reply_count ?? 0;
        const handle = u?.username ? `@${u.username}` : "unknown";
        return {
          id: `x_${t.id}`,
          source: "x" as const,
          title: t.text,
          subtitle: handle,
          url: `https://x.com/${u?.username ?? "i"}/status/${t.id}`,
          score: likes,
          numComments: replies,
          createdUtc: t.created_at
            ? Math.floor(new Date(t.created_at).getTime() / 1000)
            : 0,
          answers: [],
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return { results, status: { ok: true, count: results.length } };
  } catch {
    return {
      results: [],
      status: {
        ok: false,
        count: 0,
        note: "X could not be reached (token invalid or rate limited).",
      },
    };
  }
}
