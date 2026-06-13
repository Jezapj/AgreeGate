import { NextRequest, NextResponse } from "next/server";
import { searchReddit } from "@/lib/reddit";
import { searchHN } from "@/lib/hn";
import { searchX } from "@/lib/x";
import { getCache, setCache } from "@/lib/cache";
import { rateLimit } from "@/lib/rateLimit";
import { SearchResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT = 20; // requests
const RATE_WINDOW_MS = 60 * 1000; // per minute per IP

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "anonymous";
}

export async function GET(req: NextRequest) {
  const start = Date.now();
  const query = (req.nextUrl.searchParams.get("q") || "").trim();
  const includeX = req.nextUrl.searchParams.get("x") !== "0";

  if (!query) {
    return NextResponse.json(
      { error: "Missing query parameter ?q=" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (query.length > 300) {
    return NextResponse.json(
      { error: "Query too long." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Rate limit by client IP (best-effort; CDN cache hits never reach here).
  const ip = getClientIp(req);
  const rl = rateLimit(`search:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.ok) {
    const retryAfter = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  const cacheKey = `${includeX ? "x1" : "x0"}:${query.toLowerCase()}`;
  const cached = getCache<SearchResponse>(cacheKey);
  if (cached) {
    return NextResponse.json(
      { ...cached, cached: true },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=600, stale-while-revalidate=86400",
          "X-Cache": "HIT",
        },
      }
    );
  }

  const [reddit, hn, x] = await Promise.all([
    searchReddit(query),
    searchHN(query),
    includeX
      ? searchX(query)
      : Promise.resolve({
          results: [],
          status: { ok: false, count: 0, note: "X disabled for this search." },
        }),
  ]);

  // Reddit & HN are the primary human sources; X is secondary (bot noise).
  const results = [...reddit.results, ...hn.results, ...x.results];

  const payload: SearchResponse = {
    query,
    tookMs: Date.now() - start,
    results,
    sources: { reddit: reddit.status, hn: hn.status, x: x.status },
  };

  // Only cache responses that actually returned something useful.
  if (results.length > 0) {
    setCache(cacheKey, payload, CACHE_TTL_MS);
  }

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control":
        results.length > 0
          ? "public, s-maxage=600, stale-while-revalidate=86400"
          : "no-store",
      "X-Cache": "MISS",
    },
  });
}
