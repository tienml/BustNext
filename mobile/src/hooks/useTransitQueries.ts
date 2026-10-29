import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient, ApiError } from '../api/client';

const retryTransient = (failureCount: number, error: unknown) => {
  if (error instanceof ApiError && error.status !== undefined && error.status < 500) return false;
  return failureCount < 1;
};

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
    queryFn: ({ signal }) => apiClient.searchStops(debounced, 20, signal),
    enabled: debounced.length > 1,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: retryTransient,
    networkMode: 'offlineFirst',
  });
}

export function useRouteSearch(query: string) {
  const debounced = useDebouncedValue(query.trim(), 300);
  return useQuery({
    queryKey: ['routes', debounced],
    queryFn: ({ signal }) => apiClient.searchRoutes(debounced, undefined, 20, signal),
    enabled: debounced.length > 0,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: retryTransient,
    networkMode: 'offlineFirst',
  });
}

export function useUnifiedSearch(query: string) {
  const debounced = useDebouncedValue(query.trim(), 300);
  return useQuery({
    queryKey: ['unified-search', debounced],
    queryFn: ({ signal }) => apiClient.unifiedSearch(debounced, 10, signal),
    enabled: debounced.length > 1,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: retryTransient,
    networkMode: 'offlineFirst',
  });
}

export function useStopDetails(stopId: string) {
  return useQuery({
    queryKey: ['stop', stopId],
    queryFn: ({ signal }) => apiClient.getStop(stopId, signal),
    enabled: Boolean(stopId),
    staleTime: 60_000,
    retry: retryTransient,
    networkMode: 'offlineFirst',
  });
}

export function useNextDepartures(stopId: string, date: string, after: string) {
  return useQuery({
    queryKey: ['departures', stopId, date, after],
    queryFn: ({ signal }) => apiClient.nextDepartures(stopId, date, after, 10, signal),
    enabled: Boolean(stopId && date && after),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: retryTransient,
    networkMode: 'offlineFirst',
  });
}

export function useNearbyStops(lat?: number, lon?: number, radius = 1000) {
  return useQuery({
    queryKey: ['nearby-stops', lat, lon, radius],
    queryFn: ({ signal }) => apiClient.nearbyStops(lat as number, lon as number, radius, 10, signal),
    enabled: lat !== undefined && lon !== undefined,
    staleTime: 60_000,
    retry: retryTransient,
    networkMode: 'offlineFirst',
  });
}

export function useRouteDetails(routeId: string) {
  return useQuery({
    queryKey: ['route', routeId],
    queryFn: ({ signal }) => apiClient.getRoute(routeId, signal),
    enabled: Boolean(routeId),
    staleTime: 60_000,
    retry: retryTransient,
    networkMode: 'offlineFirst',
  });
}

export function useRouteTrips(routeId: string, date: string) {
  return useQuery({
    queryKey: ['route-trips', routeId, date],
    queryFn: ({ signal }) => apiClient.getRouteTrips(routeId, date, signal),
    enabled: Boolean(routeId && date),
    staleTime: 60_000,
    retry: retryTransient,
    networkMode: 'offlineFirst',
  });
}

export function useTripDetails(tripId: string) {
  return useQuery({
    queryKey: ['trip', tripId],
    queryFn: ({ signal }) => apiClient.getTrip(tripId, signal),
    enabled: Boolean(tripId),
    staleTime: 60_000,
    retry: retryTransient,
    networkMode: 'offlineFirst',
  });
}
