import { keywordize, queryWords } from "@/lib/query";
import { SearchResult, Source } from "@/lib/types";

/** Boost Reddit and X previews in relevance ranking. */
const SOURCE_WEIGHT: Record<Source, number> = {
  reddit: 1.7,
  x: 1.4,
  bluesky: 1,
  lemmy: 1,
  se: 1,
  hn: 1,
};

const CONTENT_WORD_MATCH = 7;
const OTHER_WORD_MATCH = 3;
const PHRASE_MATCH = 18;
const COVERAGE_BONUS = 22;
const CONTENT_COVERAGE_BONUS = 14;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordMatchStrength(text: string, word: string): number {
  if (!text || !word) return 0;
  const t = text.toLowerCase();
  const w = word.toLowerCase();
  if (!t.includes(w)) return 0;

  const boundary = new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(text);
  return boundary ? 1 : 0.65;
}

function textRelevance(
  text: string,
  contentWords: string[],
  allWords: string[],
  normalizedQuery: string,
  fieldWeight = 1
): number {
  if (!text.trim()) return 0;

  let score = 0;
  const q = normalizedQuery.toLowerCase().trim();
  if (q.length >= 4 && text.toLowerCase().includes(q)) {
    score += PHRASE_MATCH * fieldWeight;
  }

  let contentMatched = 0;
  for (const word of contentWords) {
    const strength = wordMatchStrength(text, word);
    if (strength > 0) {
      contentMatched++;
      score += CONTENT_WORD_MATCH * strength * fieldWeight;
    }
  }

  const otherWords = allWords.filter((w) => !contentWords.includes(w));
  let otherMatched = 0;
  for (const word of otherWords) {
    const strength = wordMatchStrength(text, word);
    if (strength > 0) {
      otherMatched++;
      score += OTHER_WORD_MATCH * strength * fieldWeight;
    }
  }

  const totalTerms = allWords.length;
  if (totalTerms > 0) {
    const coverage = (contentMatched + otherMatched) / totalTerms;
    score += coverage * coverage * COVERAGE_BONUS * fieldWeight;
  }

  if (contentWords.length > 0) {
    const contentCoverage = contentMatched / contentWords.length;
    score += contentCoverage * CONTENT_COVERAGE_BONUS * fieldWeight;
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
  const allWords = queryWords(query);

  const fields: { text: string; weight: number }[] = [
    { text: result.title, weight: 3 },
    { text: result.subtitle ?? "", weight: 2.2 },
    { text: result.snippet ?? "", weight: 2.2 },
    { text: result.selfText ?? "", weight: 1.6 },
    ...result.answers.map((a) => ({ text: a.body, weight: 1 })),
  ];

  let textScore = 0;
  for (const { text, weight } of fields) {
    textScore += textRelevance(text, keywords, allWords, kwQuery, weight);
  }

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
