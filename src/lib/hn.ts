import { Answer, SearchResult, SourceStatus } from "./types";
import { fetchJson, stripHtml } from "./fetchUtils";

interface HnHit {
  objectID: string;
  title: string;
  url?: string;
  author: string;
  points: number;
  num_comments: number;
  created_at_i: number;
  story_text?: string;
}

interface HnSearchResponse {
  hits: HnHit[];
}

interface HnItem {
  id: number;
  author?: string;
  text?: string;
  created_at_i?: number;
  points?: number;
  children?: HnItem[];
}

function clamp(text: string, max = 900): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function collectComments(item: HnItem, limit: number): Answer[] {
  const answers: Answer[] = [];
  for (const child of item.children ?? []) {
    if (!child.author || !child.text) continue;
    const body = stripHtml(child.text);
    if (body.length < 24) continue;
    answers.push({
      id: `hn_${child.id}`,
      author: child.author,
      body: clamp(body),
      score: child.points ?? 0,
      url: `https://news.ycombinator.com/item?id=${child.id}`,
      createdUtc: child.created_at_i ?? 0,
    });
    if (answers.length >= limit) break;
  }
  return answers;
}

async function fetchStoryComments(
  objectID: string,
  limit: number
): Promise<Answer[]> {
  try {
    const item = await fetchJson<HnItem>(
      `https://hn.algolia.com/api/v1/items/${objectID}`,
      { timeoutMs: 7000 }
    );
    return collectComments(item, limit);
  } catch {
    return [];
  }
}

export async function searchHN(
  query: string,
  opts: { stories?: number; answersPerStory?: number } = {}
): Promise<{ results: SearchResult[]; status: SourceStatus }> {
  const { stories = 5, answersPerStory = 3 } = opts;
  try {
    // optionalWords makes each term optional, so multi-word natural-language
    // queries still match relevant stories (HN otherwise requires all words).
    const encoded = encodeURIComponent(query);
    const search = await fetchJson<HnSearchResponse>(
      `https://hn.algolia.com/api/v1/search?query=${encoded}&tags=story&hitsPerPage=20&optionalWords=${encoded}`,
      { timeoutMs: 8000 }
    );

    const candidates = (search.hits ?? [])
      .filter((h) => h.title && (h.num_comments ?? 0) > 0)
      .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
      .slice(0, stories);

    const results = await Promise.all(
      candidates.map(async (h) => {
        const answers = await fetchStoryComments(h.objectID, answersPerStory);
        const result: SearchResult = {
          id: `hn_${h.objectID}`,
          source: "hn",
          title: h.title,
          subtitle: "Hacker News",
          url: `https://news.ycombinator.com/item?id=${h.objectID}`,
          score: h.points ?? 0,
          numComments: h.num_comments ?? 0,
          createdUtc: h.created_at_i ?? 0,
          selfText: h.story_text ? clamp(stripHtml(h.story_text), 400) : undefined,
          answers,
        };
        return result;
      })
    );

    const withAnswers = results
      .filter((r) => r.answers.length > 0)
      .sort((a, b) => b.score - a.score);

    return { results: withAnswers, status: { ok: true, count: withAnswers.length } };
  } catch {
    return {
      results: [],
      status: { ok: false, count: 0, note: "Hacker News could not be reached." },
    };
  }
}
