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
  } catch {
    try {
      const toEvict: { key: string; expiry: number }[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k?.startsWith('cache:')) {
          try {
            const parsed = JSON.parse(sessionStorage.getItem(k) || '{}');
            toEvict.push({ key: k, expiry: parsed.expiry || Infinity });
          } catch { toEvict.push({ key: k, expiry: Infinity }); }
        }
      }
      toEvict.sort((a, b) => a.expiry - b.expiry);
      const removeCount = Math.max(1, Math.ceil(toEvict.length * 0.25));
      for (let i = 0; i < removeCount && i < toEvict.length; i++) {
        sessionStorage.removeItem(toEvict[i].key);
        const cacheKey = toEvict[i].key.replace(/^cache:/, '');
        memoryCache.delete(cacheKey);
      }
      sessionStorage.setItem(`cache:${key}`, JSON.stringify(entry));
    } catch { /* ignore quota error */ }
  }
}

export async function prefetchCache<T>(key: string, fetcher: () => Promise<T>, staleTime = 300_000): Promise<void> {
  try {
    const data = await fetcher();
    setCache(key, data, staleTime);
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
