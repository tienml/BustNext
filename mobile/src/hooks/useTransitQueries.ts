import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function useStopSearch(query: string) {
  const debounced = useDebouncedValue(query.trim(), 300);
  return useQuery({
    queryKey: ['stops', debounced],
    queryFn: () => apiClient.searchStops(debounced),
    enabled: debounced.length > 1,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: 2,
    networkMode: 'offlineFirst',
  });
}

export function useNextDepartures(stopId: string, date: string, after: string) {
  return useQuery({
    queryKey: ['departures', stopId, date, after],
    queryFn: () => apiClient.nextDepartures(stopId, date, after),
    enabled: Boolean(stopId && date && after),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 2,
    networkMode: 'offlineFirst',
  });
}
