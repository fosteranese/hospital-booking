import { useCallback } from 'react';
import { api, Doctor } from '@/lib/api';
import { useCachedData } from './useCachedData';

export function useDoctors() {
  const { data, loading } = useCachedData(
    'doctors',
    useCallback(() => api.getDoctors(), []),
    { staleTime: 300_000 }
  );
  return { doctors: data ?? [], loading };
}
