import { BROWSER_UA, decodeEntities, fetchJson, stripHtml } from "./fetchUtils";

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

/** Parse SearXNG HTML results (fallback when JSON API is blocked). */
function parseSearxHtml(html: string): SearxHit[] {
  const results: SearxHit[] = [];
  const articleRe =
    /<article[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let match: RegExpExecArray | null;

  while ((match = articleRe.exec(html)) !== null) {
    const block = match[1];
    const titleMatch = block.match(
      /<h3>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i
    );
    if (!titleMatch) continue;

    const url = decodeEntities(titleMatch[1].trim());
    const title = stripHtml(titleMatch[2]);
    if (!url || !title) continue;

    const contentMatch = block.match(/<p class="content">\s*([\s\S]*?)\s*<\/p>/i);
    const content = contentMatch ? stripHtml(contentMatch[1]) : undefined;

    results.push({ url, title, content });
  }

  return results;
}

async function fetchSearxHtml(query: string): Promise<SearxHit[]> {
  const base = baseUrl();
  const params = new URLSearchParams({
    q: query,
    categories: "general",
    language: "en",
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${base}/search?${params.toString()}`, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
        Referer: `${base}/`,
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return [];
    return parseSearxHtml(await res.text());
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Run a web search via your self-hosted SearXNG instance. */
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

  // Prefer JSON when allowed; many instances block it (403) via bot detection.
  try {
    const json = await fetchJson<SearxResponse>(
      `${base}/search?${params.toString()}`,
      {
        timeoutMs: 12_000,
        headers: { "User-Agent": BROWSER_UA, Referer: `${base}/` },
      }
    );
    const hits = json.results ?? [];
    if (hits.length > 0) return hits.slice(0, limit);
  } catch {
    /* fall through to HTML */
  }

  return (await fetchSearxHtml(query)).slice(0, limit);
}
