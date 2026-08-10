import { rateLimit } from "./rateLimit";
import { instanceId } from "./searxngPool";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function searxngRateLimitConfig(): { limit: number; windowMs: number } {
  return {
    limit: envInt("SEARXNG_MAX_REQUESTS_PER_MIN", 10),
    windowMs: envInt("SEARXNG_RATE_WINDOW_MS", 60_000),
  };
}

export class SearxngRateLimitedError extends Error {
  readonly retryAfterSec: number;
  readonly instanceUrl?: string;

  constructor(retryAfterSec: number, instanceUrl?: string) {
    super("SearXNG request budget exhausted");
    this.name = "SearxngRateLimitedError";
    this.retryAfterSec = retryAfterSec;
    this.instanceUrl = instanceUrl;
  }
}

/** Reserve one SearXNG call for a specific instance. Throws when its budget is spent. */
export function assertSearxngBudget(instanceUrl: string): void {
  const { limit, windowMs } = searxngRateLimitConfig();
  const key = `searxng:${instanceId(instanceUrl)}`;
  const result = rateLimit(key, limit, windowMs);
  if (!result.ok) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000)
    );
    throw new SearxngRateLimitedError(retryAfterSec, instanceUrl);
  }
}
