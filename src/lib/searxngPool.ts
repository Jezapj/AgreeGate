function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** How long to skip an instance after engine suspension or hard failure. */
export const INSTANCE_COOLDOWN_MS = envInt("SEARXNG_INSTANCE_COOLDOWN_MS", 30 * 60 * 1000);

interface InstanceHealth {
  unhealthyUntil: number;
}

const health = new Map<string, InstanceHealth>();
let roundRobin = 0;

function normalizeUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

export function instanceId(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** All configured SearXNG base URLs (pool or single). */
export function getSearxInstances(): string[] {
  const list = process.env.SEARXNG_URLS?.split(",")
    .map(normalizeUrl)
    .filter(Boolean);
  if (list?.length) return [...new Set(list)];

  const single = process.env.SEARXNG_URL?.trim();
  if (single) return [normalizeUrl(single)];
  return [];
}

export function searxngConfigured(): boolean {
  return getSearxInstances().length > 0;
}

function isInCooldown(url: string, now = Date.now()): boolean {
  const entry = health.get(instanceId(url));
  return !!entry && entry.unhealthyUntil > now;
}

/** Mark an instance healthy after a successful response. */
export function markInstanceHealthy(url: string): void {
  health.delete(instanceId(url));
}

/** Skip an instance until cooldown expires (engine suspension, errors, etc.). */
export function markInstanceUnhealthy(url: string, cooldownMs = INSTANCE_COOLDOWN_MS): void {
  health.set(instanceId(url), {
    unhealthyUntil: Date.now() + cooldownMs,
  });
}

/**
 * Instances to try, healthy ones first in round-robin order.
 * Falls back to cooled-down instances if every host is marked unhealthy.
 */
export function getInstancesForAttempt(): string[] {
  const all = getSearxInstances();
  if (!all.length) return [];

  const now = Date.now();
  const healthy = all.filter((url) => !isInCooldown(url, now));
  const pool = healthy.length > 0 ? healthy : all;

  if (pool.length <= 1) return pool;

  const start = roundRobin % pool.length;
  roundRobin += 1;
  return [...pool.slice(start), ...pool.slice(0, start)];
}

/** True when SearXNG HTML reports upstream engines are suspended. */
export function htmlShowsEngineSuspension(html: string): boolean {
  return /Suspended:\s*(too many requests|access denied)/i.test(html);
}
