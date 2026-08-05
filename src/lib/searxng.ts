import { fetchJson } from "./fetchUtils";

export interface SearxHit {
  url: string;
  title: string;
  content?: string;
  engine?: string;
}

interface SearxResponse {
  results?: SearxHit[];
}

export function searxngConfigured(): boolean {
  return !!process.env.SEARXNG_URL?.trim();
}

function baseUrl(): string {
  const raw = process.env.SEARXNG_URL?.trim() || "";
  return raw.replace(/\/+$/, "");
}

/** Run a web search via your self-hosted SearXNG instance (JSON API). */
export async function searxSearch(
  query: string,
  opts: { limit?: number } = {}
): Promise<SearxHit[]> {
  const { limit = 10 } = opts;
  const base = baseUrl();
  if (!base) return [];

  const params = new URLSearchParams({
    q: query,
    format: "json",
    categories: "general",
    language: "en",
  });

  try {
    const json = await fetchJson<SearxResponse>(
      `${base}/search?${params.toString()}`,
      { timeoutMs: 12_000 }
    );
    return (json.results ?? []).slice(0, limit);
  } catch {
    return [];
  }
}
