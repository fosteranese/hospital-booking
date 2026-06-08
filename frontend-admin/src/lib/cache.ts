interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

const STALE_TIME = 300_000;

export function getCached<T>(key: string): T | null {
  const mem = memoryCache.get(key);
  if (mem && mem.expiry > Date.now()) return mem.data;

  try {
    const stored = sessionStorage.getItem(`cache:${key}`);
    if (stored) {
      const entry: CacheEntry<T> = JSON.parse(stored);
      if (entry.expiry > Date.now()) {
        memoryCache.set(key, entry);
        return entry.data;
      }
      sessionStorage.removeItem(`cache:${key}`);
    }
  } catch {}

  return null;
}

export function setCache<T>(key: string, data: T, staleTime = STALE_TIME) {
  const entry: CacheEntry<T> = { data, expiry: Date.now() + staleTime };
  memoryCache.set(key, entry);
  try {
    sessionStorage.setItem(`cache:${key}`, JSON.stringify(entry));
  } catch {}
}

export function invalidateCache(keyPrefix?: string) {
  if (keyPrefix) {
    for (const key of memoryCache.keys()) {
      if (key.startsWith(keyPrefix)) {
        memoryCache.delete(key);
        sessionStorage.removeItem(`cache:${key}`);
      }
    }
  } else {
    memoryCache.clear();
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith('cache:')) toRemove.push(k);
    }
    toRemove.forEach(k => sessionStorage.removeItem(k));
  }
}
