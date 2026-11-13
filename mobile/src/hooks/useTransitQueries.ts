import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiError, type TripSearchFilters } from '../api/client';

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
    retry: retryTransient,
    networkMode: 'offlineFirst',
  });
}

export function useRouteSearch(query: string, routeType?: number) {
  const debounced = useDebouncedValue(query.trim(), 300);
  return useQuery({
    queryKey: ['routes', debounced, routeType],
    queryFn: ({ signal }) => apiClient.searchRoutes(debounced, routeType, 20, signal),
    enabled: debounced.length > 0 || routeType !== undefined,
    staleTime: 30_000,
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

export function useNextDepartures(stopId: string, date: string, after: string, active = true, live = false) {
  return useQuery<Awaited<ReturnType<typeof apiClient.nextDepartures>>>({
    queryKey: ['departures', stopId, date, after, live],
    // Only a live clock tick may reuse rows. Never carry another stop/date or
    // an explicitly selected lookup into a new context.
    placeholderData: (previous, query) => live && query?.queryKey[1] === stopId
      && query.queryKey[2] === date && query.queryKey[4] === true ? previous : undefined,
    queryFn: ({ signal }) => apiClient.nextDepartures(stopId, date, after, 10, signal),
    enabled: active && Boolean(stopId && date && after),
    staleTime: 15_000,
    // The screen advances the current-time query key; never poll a frozen time.
    refetchInterval: false,
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

export function useTripSearch(filters: TripSearchFilters, active = true) {
  const q = useDebouncedValue(filters.q?.trim() ?? '');
  const routeId = filters.route_id?.trim() ?? '';
  const normalized = { ...filters, q, route_id: routeId };
  return useQuery({
    queryKey: ['trip-search', normalized],
    queryFn: ({ signal }) => apiClient.searchTrips(normalized, signal),
    enabled: active,
    staleTime: 30_000,
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
