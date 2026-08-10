import { BROWSER_UA, decodeEntities, fetchJson, stripHtml } from "./fetchUtils";
import { assertSearxngBudget, SearxngRateLimitedError } from "./searxngLimit";
import {
  getInstancesForAttempt,
  htmlShowsEngineSuspension,
  markInstanceHealthy,
  markInstanceUnhealthy,
  searxngConfigured,
} from "./searxngPool";

export { SearxngRateLimitedError } from "./searxngLimit";
export { getSearxInstances, searxngConfigured } from "./searxngPool";

export interface SearxHit {
  url: string;
  title: string;
  content?: string;
  engine?: string;
}

interface SearxResponse {
  results?: SearxHit[];
}

interface ParseResult {
  hits: SearxHit[];
  enginesSuspended: boolean;
}

/** Parse SearXNG HTML results (fallback when JSON API is blocked). */
function parseSearxHtml(html: string): ParseResult {
  const results: SearxHit[] = [];
  const seen = new Set<string>();

  function pushHit(url: string, title: string, content?: string) {
    const cleanUrl = decodeEntities(url.trim());
    const cleanTitle = stripHtml(title);
    if (!cleanUrl || !cleanTitle || seen.has(cleanUrl)) return;
    seen.add(cleanUrl);
    results.push({ url: cleanUrl, title: cleanTitle, content });
  }

  const articleRe =
    /<article[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let match: RegExpExecArray | null;

  while ((match = articleRe.exec(html)) !== null) {
    const block = match[1];
    const titleMatch = block.match(
      /<h3>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i
    );
    if (!titleMatch) continue;

    const contentMatch = block.match(/<p class="content">\s*([\s\S]*?)\s*<\/p>/i);
    const content = contentMatch ? stripHtml(contentMatch[1]) : undefined;
    pushHit(titleMatch[1], titleMatch[2], content);
  }

  if (results.length === 0) {
    const titleRe =
      /<h3>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>\s*(?:<!--[\s\S]*?-->\s*)?<p class="content">\s*([\s\S]*?)\s*<\/p>/gi;
    while ((match = titleRe.exec(html)) !== null) {
      pushHit(match[1], match[2], stripHtml(match[3]));
    }
  }

  return {
    hits: results,
    enginesSuspended: htmlShowsEngineSuspension(html),
  };
}

async function fetchSearxHtml(base: string, query: string): Promise<ParseResult> {
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
    if (!res.ok) {
      return { hits: [], enginesSuspended: false };
    }
    return parseSearxHtml(await res.text());
  } catch {
    return { hits: [], enginesSuspended: false };
  } finally {
    clearTimeout(timer);
  }
}

async function searchOnInstance(
  base: string,
  query: string,
  limit: number
): Promise<ParseResult> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    categories: "general",
    language: "en",
  });

  try {
    const json = await fetchJson<SearxResponse>(
      `${base}/search?${params.toString()}`,
      {
        timeoutMs: 12_000,
        headers: { "User-Agent": BROWSER_UA, Referer: `${base}/` },
      }
    );
    const hits = json.results ?? [];
    if (hits.length > 0) {
      return { hits: hits.slice(0, limit), enginesSuspended: false };
    }
  } catch {
    /* fall through to HTML */
  }

  const htmlResult = await fetchSearxHtml(base, query);
  return {
    hits: htmlResult.hits.slice(0, limit),
    enginesSuspended: htmlResult.enginesSuspended,
  };
}

/**
 * Run a web search via your SearXNG pool. Tries instances in round-robin order,
 * skipping unhealthy hosts and failing over on suspension or per-instance limits.
 */
export async function searxSearch(
  query: string,
  opts: { limit?: number } = {}
): Promise<SearxHit[]> {
  const { limit = 10 } = opts;
  const instances = getInstancesForAttempt();
  if (!instances.length) return [];

  let shortestRetrySec = 60;
  let triedAny = false;

  for (const base of instances) {
    try {
      assertSearxngBudget(base);
    } catch (e) {
      if (e instanceof SearxngRateLimitedError) {
        shortestRetrySec = Math.min(shortestRetrySec, e.retryAfterSec);
        continue;
      }
      throw e;
    }

    triedAny = true;
    const result = await searchOnInstance(base, query, limit);

    if (result.enginesSuspended) {
      markInstanceUnhealthy(base);
      continue;
    }

    markInstanceHealthy(base);
    return result.hits;
  }

  if (triedAny) return [];

  throw new SearxngRateLimitedError(shortestRetrySec);
}
