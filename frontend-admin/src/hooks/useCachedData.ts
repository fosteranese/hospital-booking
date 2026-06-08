import { useState, useEffect, useCallback, useRef } from 'react';
import { getCached, setCache } from '@/lib/cache';

const inflight = new Map<string, Promise<any>>();

export function useCachedData<T>(
  cacheKey: string | null,
  fetcher: () => Promise<T>,
  options?: { staleTime?: number; enabled?: boolean }
): { data: T | null; loading: boolean; error: string; refresh: () => void } {
  const cached = cacheKey ? getCached<T>(cacheKey) : null;
  const [data, setData] = useState<T | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);
  const keyRef = useRef(cacheKey);
  const hasCachedRef = useRef(!!cached);

  keyRef.current = cacheKey;

  const fetch = useCallback((silent = false) => {
    if (!cacheKey) return;
    const key = cacheKey;

    if (!silent) {
      setLoading(true);
    }
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

    hasCachedRef.current = !!getCached<T>(cacheKey);

    // Silent background refresh — never shows loading if we have cached data
    fetch(hasCachedRef.current);
  }, [cacheKey, options?.enabled, fetch]);

  const refresh = useCallback(() => {
    fetch(false);
  }, [fetch]);

  return { data, loading, error, refresh };
}
