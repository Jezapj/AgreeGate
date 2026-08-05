import { Answer, SearchResult, SourceStatus } from "./types";
import { BROWSER_UA, fetchJson } from "./fetchUtils";
import { isRelevant, keywordize } from "./query";

const INSTANCE = process.env.LEMMY_INSTANCE || "https://lemmy.world";

interface LemmyPostView {
  post: {
    id: number;
    name: string;
    body?: string;
    url?: string;
    ap_id: string;
    published: string;
    deleted?: boolean;
    removed?: boolean;
  };
  creator: { name: string; bot_account?: boolean };
  community: { name: string; title?: string };
  counts: { score: number; comments: number };
}

interface LemmyCommentView {
  comment: {
    id: number;
    content: string;
    ap_id: string;
    published: string;
    deleted?: boolean;
    removed?: boolean;
  };
  creator: { name: string; bot_account?: boolean };
  counts: { score: number };
}

function clamp(text: string, max = 900): string {
  const t = (text || "").replace(/\s+\n/g, "\n").trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function epoch(iso: string): number {
  const t = Date.parse(iso);
  return isNaN(t) ? 0 : Math.floor(t / 1000);
}

async function fetchComments(postId: number, limit: number): Promise<Answer[]> {
  try {
    const url =
      `${INSTANCE}/api/v3/comment/list?post_id=${postId}` +
      `&sort=Top&limit=${limit + 4}&max_depth=1&type_=All`;
    const json = await fetchJson<{ comments: LemmyCommentView[] }>(url, {
      timeoutMs: 7000,
      headers: { "User-Agent": BROWSER_UA },
    });
    const answers: Answer[] = [];
    for (const c of json.comments ?? []) {
      if (c.comment.deleted || c.comment.removed || c.creator.bot_account) continue;
      const body = (c.comment.content || "").trim();
      if (body.length < 24) continue;
      answers.push({
        id: `lemmy_c_${c.comment.id}`,
        author: c.creator.name,
        body: clamp(body),
        score: c.counts.score ?? 0,
        url: c.comment.ap_id,
        createdUtc: epoch(c.comment.published),
      });
      if (answers.length >= limit) break;
    }
    return answers;
  } catch {
    return [];
  }
}

export async function searchLemmy(
  query: string,
  opts: { posts?: number; answersPerPost?: number } = {}
): Promise<{ results: SearchResult[]; status: SourceStatus }> {
  const { posts = 4, answersPerPost = 3 } = opts;
  try {
    const { keywords, query: kw } = keywordize(query);
    const url =
      `${INSTANCE}/api/v3/search?q=${encodeURIComponent(kw)}` +
      `&type_=Posts&sort=TopAll&limit=15`;
    const json = await fetchJson<{ posts: LemmyPostView[] }>(url, {
      timeoutMs: 8000,
      headers: { "User-Agent": BROWSER_UA },
    });

    const candidates = (json.posts ?? [])
      .filter(
        (p) =>
          !p.post.deleted &&
          !p.post.removed &&
          (p.counts.comments ?? 0) > 0 &&
          isRelevant(`${p.post.name} ${p.post.body ?? ""}`, keywords)
      )
      .sort((a, b) => (b.counts.score ?? 0) - (a.counts.score ?? 0))
      .slice(0, posts);

    const withComments = await Promise.all(
      candidates.map(async (p) => {
        const answers = await fetchComments(p.post.id, answersPerPost);
        const result: SearchResult = {
          id: `lemmy_${p.post.id}`,
          source: "lemmy",
          title: p.post.name,
          subtitle: `c/${p.community.name}`,
          url: p.post.ap_id,
          score: p.counts.score ?? 0,
          numComments: p.counts.comments ?? 0,
          createdUtc: epoch(p.post.published),
          selfText: p.post.body ? clamp(p.post.body, 360) : undefined,
          answers,
        };
        return result;
      })
    );

    const results = withComments
      .filter((r) => r.answers.length > 0)
      .sort((a, b) => b.score - a.score);

    return { results, status: { ok: true, count: results.length } };
  } catch {
    return {
      results: [],
      status: { ok: false, count: 0, note: "Lemmy could not be reached." },
    };
  }
}
