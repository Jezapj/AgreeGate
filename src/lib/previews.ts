import { SearchResult, SourceStatus } from "./types";
import { searxngConfigured, searxSearch } from "./searxng";
import { stripHtml } from "./fetchUtils";

const OFF_NOTE =
  "Reddit & X previews are off — set SEARXNG_URL to your SearXNG instance (see README).";

function clamp(text: string, max = 280): string {
  const t = stripHtml(text).replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function redditSub(url: string): string | undefined {
  try {
    const m = new URL(url).pathname.match(/\/r\/([^/]+)/i);
    return m ? `r/${m[1]}` : undefined;
  } catch {
    return undefined;
  }
}

function xHandle(url: string): string | undefined {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && parts[1] === "status") return `@${parts[0]}`;
    return undefined;
  } catch {
    return undefined;
  }
}

function isRedditPost(url: string): boolean {
  const h = hostOf(url);
  if (!h.endsWith("reddit.com")) return false;
  try {
    const p = new URL(url).pathname;
    return p.includes("/comments/") || /^\/r\/[^/]+\/comments\//.test(p);
  } catch {
    return false;
  }
}

function isXPost(url: string): boolean {
  const h = hostOf(url);
  if (h !== "x.com" && h !== "twitter.com" && h !== "mobile.twitter.com") return false;
  try {
    return /\/status\/\d+/.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function toPreview(
  hit: { url: string; title: string; content?: string },
  source: "reddit" | "x",
  index: number
): SearchResult {
  const subtitle =
    source === "reddit"
      ? redditSub(hit.url) ?? "reddit.com"
      : xHandle(hit.url) ?? "x.com";

  return {
    id: `${source}_preview_${index}_${hashCode(hit.url)}`,
    source,
    title: clamp(hit.title, 200),
    subtitle,
    url: hit.url,
    score: 0,
    createdUtc: 0,
    snippet: hit.content ? clamp(hit.content) : undefined,
    preview: true,
    answers: [],
  };
}

function hashCode(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

async function searchSitePreviews(
  query: string,
  site: "reddit.com" | "x.com",
  source: "reddit" | "x",
  limit: number
): Promise<SearchResult[]> {
  const hits = await searxSearch(`site:${site} ${query}`, { limit: limit + 5 });
  const seen = new Set<string>();
  const results: SearchResult[] = [];

  for (const hit of hits) {
    if (!hit.url || !hit.title) continue;
    const ok = source === "reddit" ? isRedditPost(hit.url) : isXPost(hit.url);
    if (!ok) continue;
    const key = hit.url.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(toPreview(hit, source, results.length));
    if (results.length >= limit) break;
  }

  return results;
}

export async function searchRedditPreviews(
  query: string,
  opts: { limit?: number } = {}
): Promise<{ results: SearchResult[]; status: SourceStatus }> {
  const { limit = 6 } = opts;
  if (!searxngConfigured()) {
    return { results: [], status: { ok: false, count: 0, note: OFF_NOTE } };
  }
  try {
    const results = await searchSitePreviews(query, "reddit.com", "reddit", limit);
    return {
      results,
      status: { ok: true, count: results.length },
    };
  } catch {
    return {
      results: [],
      status: { ok: false, count: 0, note: "SearXNG could not be reached for Reddit." },
    };
  }
}

export async function searchXPreviews(
  query: string,
  opts: { limit?: number } = {}
): Promise<{ results: SearchResult[]; status: SourceStatus }> {
  const { limit = 5 } = opts;
  if (!searxngConfigured()) {
    return { results: [], status: { ok: false, count: 0 } };
  }
  try {
    // Search both x.com and twitter.com domains via two queries, merge.
    const [xHits, twHits] = await Promise.all([
      searchSitePreviews(query, "x.com", "x", limit),
      searxSearch(`site:twitter.com ${query}`, { limit: limit + 3 }).then((hits) => {
        const seen = new Set<string>();
        const out: SearchResult[] = [];
        for (const hit of hits) {
          if (!hit.url || !isXPost(hit.url)) continue;
          const key = hit.url.split("?")[0];
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(toPreview(hit, "x", out.length));
          if (out.length >= limit) break;
        }
        return out;
      }),
    ]);

    const merged = [...xHits];
    const seen = new Set(xHits.map((r) => r.url.split("?")[0]));
    for (const r of twHits) {
      const key = r.url.split("?")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(r);
      if (merged.length >= limit) break;
    }

    return { results: merged.slice(0, limit), status: { ok: true, count: merged.length } };
  } catch {
    return {
      results: [],
      status: { ok: false, count: 0, note: "SearXNG could not be reached for X." },
    };
  }
}
