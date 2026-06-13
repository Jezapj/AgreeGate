interface Entry<T> {
  value: T;
  expires: number;
}

const MAX_ENTRIES = 500;
const store = new Map<string, Entry<unknown>>();

/**
 * Tiny in-memory TTL cache. On serverless this persists per warm instance,
 * which (together with CDN caching) meaningfully cuts upstream API calls.
 */
export function getCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    store.delete(key);
    return null;
  }
  // Refresh LRU ordering.
  store.delete(key);
  store.set(key, entry);
  return entry.value as T;
}

export function setCache<T>(key: string, value: T, ttlMs: number): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expires: Date.now() + ttlMs });
}
