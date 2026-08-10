import { keywordize } from "@/lib/query";
import { SearchResult, Source } from "@/lib/types";

/** Slight boost for Reddit and X previews; Reddit weighted highest. */
const SOURCE_WEIGHT: Record<Source, number> = {
  reddit: 1.35,
  x: 1.15,
  bluesky: 1,
  lemmy: 1,
  se: 1,
  hn: 1,
};

function textRelevance(
  text: string,
  keywords: string[],
  normalizedQuery: string
): number {
  const t = (text || "").toLowerCase();
  if (!t) return 0;

  let score = 0;
  const q = normalizedQuery.toLowerCase().trim();
  if (q.length >= 4 && t.includes(q)) score += 10;

  for (const kw of keywords) {
    if (t.includes(kw)) score += 3;
  }

  return score;
}

function engagementBoost(result: SearchResult): number {
  const votes = Math.log10(Math.max(1, result.score + 1)) * 1.2;
  const comments = result.numComments
    ? Math.log10(Math.max(1, result.numComments + 1)) * 0.8
    : 0;
  const answers = result.answers.length
    ? Math.log10(Math.max(1, result.answers.length + 1)) * 0.5
    : 0;
  return votes + comments + answers;
}

/** Score how well a result matches the user's query. */
export function scoreResult(query: string, result: SearchResult): number {
  const { keywords, query: kwQuery } = keywordize(query);
  const corpus = [
    result.title,
    result.subtitle ?? "",
    result.snippet ?? "",
    result.selfText ?? "",
    ...result.answers.map((a) => a.body),
  ].join(" ");

  const textScore = textRelevance(corpus, keywords, kwQuery);
  const raw = textScore + engagementBoost(result);
  return raw * SOURCE_WEIGHT[result.source];
}

/** Sort results by query relevance, with a slight Reddit / X bias. */
export function rankResults(
  query: string,
  results: SearchResult[]
): SearchResult[] {
  return [...results].sort(
    (a, b) => scoreResult(query, b) - scoreResult(query, a)
  );
}

/** Group results by source, preserving relevance order within each group. */
export function groupResultsBySource(
  results: SearchResult[],
  prioritySource?: Source | null
): { source: Source; results: SearchResult[] }[] {
  const map = new Map<Source, SearchResult[]>();
  const order: Source[] = [];

  for (const result of results) {
    if (!map.has(result.source)) {
      map.set(result.source, []);
      order.push(result.source);
    }
    map.get(result.source)!.push(result);
  }

  const orderedSources =
    prioritySource && map.has(prioritySource)
      ? [prioritySource, ...order.filter((s) => s !== prioritySource)]
      : order;

  return orderedSources.map((source) => ({
    source,
    results: map.get(source)!,
  }));
}
