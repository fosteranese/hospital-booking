import { useState, useEffect, useCallback, useRef } from 'react';
import { getCached, setCache } from '@/lib/cache';

const inflight = new Map<string, Promise<any>>();

export function useCachedData<T>(
  cacheKey: string | null,
  fetcher: () => Promise<T>,
  options?: { staleTime?: number; enabled?: boolean }
): { data: T | null; loading: boolean; error: string; refresh: () => void } {
  const [data, setData] = useState<T | null>(() => (cacheKey ? getCached<T>(cacheKey) : null));
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);
  const keyRef = useRef(cacheKey);

  keyRef.current = cacheKey;

  const fetch = useCallback(() => {
    if (!cacheKey) return;
    const key = cacheKey;

    setLoading(true);
    setError('');

    const doFetch = () => {
      const pending = inflight.get(key);
      if (pending) return pending;

      const promise = fetcher()
        .then(result => {
          setCache(key, result, options?.staleTime);
          if (mountedRef.current && keyRef.current === key) {
            setData(result);
            setLoading(false);
          }
          return result;
        })
        .catch(e => {
          if (mountedRef.current && keyRef.current === key) {
            setError(e.message || 'Failed to load');
            setLoading(false);
          }
          throw e;
        })
        .finally(() => {
          inflight.delete(key);
        });

      inflight.set(key, promise);
      return promise;
    };

    doFetch().catch(() => {});
  }, [cacheKey, fetcher, options?.staleTime]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (options?.enabled === false) return;
    if (!cacheKey) return;

    // If we already have cached data, do a background refresh
    if (getCached<T>(cacheKey)) {
      fetch();
    } else {
      fetch();
    }
  }, [cacheKey, options?.enabled, fetch]);

  return { data, loading, error, refresh: fetch };
}
