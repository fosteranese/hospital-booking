import { useState, useEffect, useCallback, useRef } from 'react';
import { getCached, setCache, invalidateCache } from '@/lib/cache';
import { useRefresh } from '@/contexts/refresh-context';

const inflight = new Map<string, Promise<any>>();

function isRetryableError(message: string): boolean {
  return message.includes('Unable to reach the server') || message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('500') || message.includes('502') || message.includes('503');
}

export function useCachedData<T>(
  cacheKey: string | null,
  fetcher: () => Promise<T>,
  options?: { staleTime?: number; enabled?: boolean; retryCount?: number }
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
  const retryCountRef = useRef(options?.retryCount ?? 1);
  const servedKeyRef = useRef<string | null>(null);
  const { registerRefresh, unregisterRefresh } = useRefresh();

  keyRef.current = cacheKey;
  fetcherRef.current = fetcher;
  staleTimeRef.current = options?.staleTime;
  retryCountRef.current = options?.retryCount ?? 1;

  const fetchWithRetry = useCallback(async (key: string, silent: boolean, attempt: number): Promise<T> => {
    try {
      const result = await fetcherRef.current();
      setCache(key, result, staleTimeRef.current);
      return result;
    } catch (e: any) {
      if (attempt < retryCountRef.current && isRetryableError(e.message || '')) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        if (!mountedRef.current || keyRef.current !== key) throw e;
        return fetchWithRetry(key, silent, attempt + 1);
      }
      throw e;
    }
  }, []);

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

    const promise = fetchWithRetry(key, silent, 0)
      .then(result => {
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
  }, [cacheKey, registerRefresh, unregisterRefresh, fetchWithRetry]);

  const visibilityHandledRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && cacheKey && options?.enabled !== false) {
        if (!visibilityHandledRef.current) {
          visibilityHandledRef.current = true;
          return;
        }
        fetch(true);
      }
    };
    visibilityHandledRef.current = false;
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [cacheKey, options?.enabled, fetch]);

  useEffect(() => {
    if (options?.enabled === false) return;
    if (!cacheKey) return;

    const cached = getCached<T>(cacheKey);
    hasCachedRef.current = !!cached;

    if (cached && servedKeyRef.current !== cacheKey) {
      servedKeyRef.current = cacheKey;
      setData(cached);
      setLoading(false);
      fetch(true);
    } else {
      fetch(hasCachedRef.current);
    }
  }, [cacheKey, options?.enabled, fetch]);

  const refresh = useCallback(() => {
    if (cacheKey) {
      if (cacheKey.startsWith('appointments')) invalidateCache('appointments');
      else if (cacheKey.startsWith('dashboard')) invalidateCache('dashboard');
      else if (cacheKey.startsWith('unavailability')) invalidateCache('unavailability');
    }
    return fetch(false);
  }, [cacheKey, fetch]);

  const backgroundRefresh = useCallback(() => {
    if (cacheKey) {
      if (cacheKey.startsWith('appointments')) invalidateCache('appointments');
      else if (cacheKey.startsWith('dashboard')) invalidateCache('dashboard');
      else if (cacheKey.startsWith('unavailability')) invalidateCache('unavailability');
    }
    return fetch(true);
  }, [cacheKey, fetch]);

  return { data, loading, refreshing, error, refresh, backgroundRefresh };
}
