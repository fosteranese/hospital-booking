import { useState, useEffect, useCallback, useRef } from 'react';
import { getCached, setCache } from '@/lib/cache';
import { useRefresh } from '@/contexts/refresh-context';

const inflight = new Map<string, Promise<any>>();

export function useCachedData<T>(
  cacheKey: string | null,
  fetcher: () => Promise<T>,
  options?: { staleTime?: number; enabled?: boolean }
): { data: T | null; loading: boolean; refreshing: boolean; error: string; refresh: () => Promise<void>; backgroundRefresh: () => Promise<void> } {
  const cached = cacheKey ? getCached<T>(cacheKey) : null;
  const [data, setData] = useState<T | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);
  const keyRef = useRef(cacheKey);
  const hasCachedRef = useRef(!!cached);
  const fetcherRef = useRef(fetcher);
  const staleTimeRef = useRef(options?.staleTime);
  const { registerRefresh, unregisterRefresh } = useRefresh();

  keyRef.current = cacheKey;
  fetcherRef.current = fetcher;
  staleTimeRef.current = options?.staleTime;

  const fetch = useCallback((silent = false): Promise<void> => {
    if (!cacheKey) return Promise.resolve();
    const key = cacheKey;

    if (!silent) {
      setLoading(true);
    }
    setError('');

    const pending = inflight.get(key);
    if (pending) return pending.then(() => {}, () => {});

    if (silent) {
      setRefreshing(true);
      registerRefresh();
    }

    const promise = fetcherRef.current()
      .then(result => {
        setCache(key, result, staleTimeRef.current);
        if (mountedRef.current && keyRef.current === key) {
          setData(result);
          setLoading(false);
          setRefreshing(false);
        }
      })
      .catch(e => {
        if (mountedRef.current && keyRef.current === key) {
          setError(e.message || 'Failed to load');
          setLoading(false);
          setRefreshing(false);
        }
      })
      .finally(() => {
        inflight.delete(key);
        if (silent) {
          unregisterRefresh();
        }
      });

    inflight.set(key, promise);
    return promise;
  }, [cacheKey, registerRefresh, unregisterRefresh]);

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
    return fetch(false);
  }, [fetch]);

  const backgroundRefresh = useCallback(() => {
    return fetch(true);
  }, [fetch]);

  return { data, loading, refreshing, error, refresh, backgroundRefresh };
}
