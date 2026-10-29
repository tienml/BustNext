import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError, type ApiClient, type SavedQuery } from '../api/client';
import { useAuth } from './useAuth';

const retryTransient = (failureCount: number, error: unknown) => {
  if (error instanceof ApiError && error.status !== undefined && error.status < 500) return false;
  return failureCount < 1;
};

/** API client carrying the signed-in admin's token. */
export function useAdminClient(): ApiClient {
  const { token } = useAuth();
  return useMemo(() => (token ? apiClient.withToken(token) : apiClient), [token]);
}

export const adminKeys = {
  datasets: ['admin', 'datasets'] as const,
  versions: (datasetId: number) => ['admin', 'versions', datasetId] as const,
  validation: (versionId: number, page: number) => ['admin', 'validation', versionId, page] as const,
  compare: (baseId: number, targetId: number) => ['admin', 'compare', baseId, targetId] as const,
  queries: (datasetId: number) => ['admin', 'queries', datasetId] as const,
};

export function useDatasets() {
  const api = useAdminClient();
  return useQuery({
    queryKey: adminKeys.datasets,
    queryFn: ({ signal }) => api.datasets(signal),
    select: (response) => response.data.data,
    retry: retryTransient,
  });
}

export function useVersions(datasetId?: number) {
  const api = useAdminClient();
  return useQuery({
    queryKey: adminKeys.versions(datasetId ?? 0),
    queryFn: ({ signal }) => api.versions(datasetId as number, signal),
    select: (response) => response.data.data,
    enabled: datasetId !== undefined,
    retry: retryTransient,
  });
}

export function useValidationIssues(versionId: number, page: number) {
  const api = useAdminClient();
  return useQuery({
    queryKey: adminKeys.validation(versionId, page),
    queryFn: ({ signal }) => api.validationIssues(versionId, page, signal),
    select: (response) => response.data,
    retry: retryTransient,
  });
}

export function useComparison(baseId?: number, targetId?: number) {
  const api = useAdminClient();
  return useQuery({
    queryKey: adminKeys.compare(baseId ?? 0, targetId ?? 0),
    queryFn: ({ signal }) => api.compareVersions(baseId as number, targetId as number, signal),
    select: (response) => response.data,
    enabled: baseId !== undefined && targetId !== undefined && baseId !== targetId,
    retry: retryTransient,
  });
}

export function useSavedQueries(datasetId?: number) {
  const api = useAdminClient();
  return useQuery({
    queryKey: adminKeys.queries(datasetId ?? 0),
    queryFn: ({ signal }) => api.savedQueries(datasetId as number, signal),
    select: (response) => response.data,
    enabled: datasetId !== undefined,
    retry: retryTransient,
  });
}

/** Refresh everything that depends on which version is active. */
function useInvalidateSchedule() {
  const client = useQueryClient();
  return () => client.invalidateQueries({
    predicate: (query) => query.queryKey[0] !== 'favorites',
  });
}

export function useImportVersion(datasetId?: number) {
  const api = useAdminClient();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: Parameters<typeof apiClient.importVersion>[1]; label?: string }) =>
      api.importVersion(datasetId as number, input.file, input.label),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin', 'versions'] });
    },
  });
}

export function useActivateVersion() {
  const api = useAdminClient();
  const invalidate = useInvalidateSchedule();
  return useMutation({
    mutationFn: (versionId: number) => api.activateVersion(versionId),
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useCreateSavedQuery(datasetId?: number) {
  const api = useAdminClient();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Pick<SavedQuery, 'name' | 'type' | 'params'>) => api.createSavedQuery(datasetId as number, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.queries(datasetId ?? 0) });
    },
  });
}

export function useDeleteSavedQuery(datasetId?: number) {
  const api = useAdminClient();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (queryId: number) => api.deleteSavedQuery(queryId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.queries(datasetId ?? 0) });
    },
  });
}

export function useRunSavedQueries(datasetId?: number) {
  const api = useAdminClient();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (queryId?: number) => (queryId === undefined
      ? api.runAllSavedQueries(datasetId as number).then((response) => response.data)
      : api.runSavedQuery(queryId).then((response) => [response.data])),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: adminKeys.queries(datasetId ?? 0) });
    },
  });
}
