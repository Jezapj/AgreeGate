interface Bucket {
  count: number;
  reset: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Epoch milliseconds when the window resets. */
  reset: number;
}

/**
 * Fixed-window per-key rate limiter (best-effort, in-memory).
 *
 * Note: on serverless this is per warm instance, so it's a soft guard rather
 * than a hard global cap. Swap in Upstash/Vercel KV later for a strict limit.
 */
export function rateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || bucket.reset < now) {
    bucket = { count: 0, reset: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  // Opportunistic cleanup to bound memory.
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) {
      if (b.reset < now) buckets.delete(k);
    }
  }

  const remaining = Math.max(0, limit - bucket.count);
  return { ok: bucket.count <= limit, limit, remaining, reset: bucket.reset };
}
