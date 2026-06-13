export const USER_AGENT =
  "AgreeGate/0.1 (real-human-answers search; +https://agreegate.local)";

export async function fetchJson<T>(
  url: string,
  opts: { headers?: Record<string, string>; timeoutMs?: number } = {}
): Promise<T> {
  const { headers = {}, timeoutMs = 8000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...headers },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Decode common HTML entities returned by Reddit's API. */
export function decodeEntities(input: string): string {
  if (!input) return "";
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x200B;/g, "")
    .replace(/&nbsp;/g, " ");
}

/** Strip HTML tags (Hacker News comment bodies are HTML) and normalize whitespace. */
export function stripHtml(input: string): string {
  if (!input) return "";
  return decodeEntities(
    input
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\s*\/p\s*>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
