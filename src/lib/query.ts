// Filler/question words that hurt recall on keyword-matching search APIs.
const STOP = new Set([
  "how", "to", "do", "does", "did", "doing", "i", "my", "me", "we", "us",
  "a", "an", "the", "is", "are", "am", "was", "were", "be", "being", "been",
  "of", "for", "in", "on", "at", "by", "it", "its", "this", "that", "these",
  "those", "can", "could", "should", "would", "will", "shall", "may", "might",
  "what", "whats", "which", "who", "whom", "whose", "why", "when", "where",
  "and", "or", "but", "if", "so", "than", "then", "vs", "versus",
  "you", "your", "yours", "im", "ive", "id", "get", "got", "getting",
  "any", "some", "good", "best", "better", "way", "ways", "really", "actually",
  "please", "help", "need", "want", "about", "into", "from", "with", "without",
]);

export interface Keywordized {
  /** Significant content words, lowercased. */
  keywords: string[];
  /** A space-joined keyword string for keyword-matching search APIs. */
  query: string;
}

/**
 * Reduce a natural-language question to its core keywords. This dramatically
 * improves recall on APIs that match query terms literally (Bluesky, Lemmy),
 * e.g. "how to clean matted hair" -> "clean matted hair".
 */
export function keywordize(input: string): Keywordized {
  const words = input
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const keywords = words.filter((w) => w.length >= 3 && !STOP.has(w));
  const query = keywords.length ? keywords.join(" ") : input.trim();
  return { keywords, query };
}

/** True if the text contains at least one of the keywords (or none given). */
export function isRelevant(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const t = (text || "").toLowerCase();
  return keywords.some((k) => t.includes(k));
}
