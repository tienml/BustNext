import { useQuery } from '@tanstack/react-query';
import { ApiError, apiClient } from '../api/client';

const retryTransient = (failureCount: number, error: unknown) => {
  if (error instanceof ApiError && error.status !== undefined && error.status < 500) return false;
  return failureCount < 1;
};

export function useJourneyPlan(fromStopId: string, toStopId: string, date: string, time: string) {
  return useQuery({
    queryKey: ['journey-plan', fromStopId, toStopId, date, time],
    queryFn: ({ signal }) => apiClient.planJourney(fromStopId, toStopId, date, time, 1, 5, signal),
    enabled: Boolean(fromStopId && toStopId && date && time && fromStopId !== toStopId),
    staleTime: 15_000,
    retry: retryTransient,
  });
}
