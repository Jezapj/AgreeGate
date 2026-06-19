import { SearchResult, SourceStatus } from "./types";
import { BROWSER_UA, fetchJson } from "./fetchUtils";

interface BskyAuthor {
  did: string;
  handle: string;
  displayName?: string;
}
interface BskyPost {
  uri: string;
  cid: string;
  author: BskyAuthor;
  record: { text?: string; createdAt?: string };
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  quoteCount?: number;
  indexedAt?: string;
}
interface BskySearchResponse {
  posts: BskyPost[];
}

/** Heuristic spam/bot score; higher = more likely junk. */
function junkScore(post: BskyPost): number {
  let score = 0;
  const text = post.record.text || "";
  const links = (text.match(/https?:\/\//g) || []).length;
  const hashtags = (text.match(/#\w+/g) || []).length;
  const mentions = (text.match(/@[\w.]+/g) || []).length;
  const handle = post.author.handle.toLowerCase();

  if (links >= 2) score += 2;
  if (hashtags >= 5) score += 2;
  if (mentions >= 5) score += 1;
  if (/\b(giveaway|airdrop|free crypto|dm me|promo code|onlyfans|click here)\b/i.test(text))
    score += 4;
  if (/(^|\.)bot\.|bot\.bsky|headlines|rssfeed|feedbot/i.test(handle)) score += 3;
  if (text.trim().length < 18) score += 2;
  return score;
}

function postUrl(post: BskyPost): string {
  const rkey = post.uri.split("/").pop();
  return `https://bsky.app/profile/${post.author.handle}/post/${rkey}`;
}

export async function searchBluesky(
  query: string,
  opts: { limit?: number } = {}
): Promise<{ results: SearchResult[]; status: SourceStatus }> {
  const { limit = 8 } = opts;
  try {
    const url =
      `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts` +
      `?q=${encodeURIComponent(query)}&limit=${Math.min(limit * 3, 40)}&sort=top`;
    const json = await fetchJson<BskySearchResponse>(url, {
      timeoutMs: 8000,
      headers: { "User-Agent": BROWSER_UA },
    });

    const results: SearchResult[] = (json.posts ?? [])
      .filter((p) => p.record?.text && junkScore(p) <= 1)
      .map((p) => {
        const name = p.author.displayName?.trim();
        return {
          id: `bsky_${p.cid}`,
          source: "bluesky" as const,
          title: p.record.text || "",
          subtitle: name ? `${name} · @${p.author.handle}` : `@${p.author.handle}`,
          url: postUrl(p),
          score: p.likeCount ?? 0,
          numComments: p.replyCount ?? 0,
          createdUtc: p.record.createdAt
            ? Math.floor(new Date(p.record.createdAt).getTime() / 1000)
            : p.indexedAt
            ? Math.floor(new Date(p.indexedAt).getTime() / 1000)
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
      status: { ok: false, count: 0, note: "Bluesky could not be reached." },
    };
  }
}
