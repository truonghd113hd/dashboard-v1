import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BreakdownItem, DatasetMeta, RecordsPage, SummaryResult, SyncState, TaskDashboard, TimeseriesPoint } from '@dashboard/shared';

type Params = Record<string, string | number | undefined>;

async function get<T>(path: string, params: Params = {}): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
  const res = await fetch(`/api${path}${qs.size ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? res.statusText);
  return res.json() as Promise<T>;
}

const ds = (name: string) => `/datasets/${encodeURIComponent(name)}`;

export const useDatasets = () => useQuery({ queryKey: ['datasets'], queryFn: () => get<DatasetMeta[]>('/datasets'), refetchInterval: 30_000 });
export const useSummary = (name: string, p: Params) => useQuery({ queryKey: ['summary', name, p], queryFn: () => get<SummaryResult>(`${ds(name)}/stats/summary`, p) });
export const useTimeseries = (name: string, p: Params) => useQuery({ queryKey: ['ts', name, p], queryFn: () => get<TimeseriesPoint[]>(`${ds(name)}/stats/timeseries`, p) });
export const useBreakdown = (name: string, p: Params, enabled = true) => useQuery({ queryKey: ['bd', name, p], queryFn: () => get<BreakdownItem[]>(`${ds(name)}/stats/breakdown`, p), enabled });
export const useRecords = (name: string, p: Params) => useQuery({ queryKey: ['rec', name, p], queryFn: () => get<RecordsPage>(`${ds(name)}/records`, p), placeholderData: (prev) => prev });

export const useTaskDashboard = (p: Params) =>
  useQuery({ queryKey: ['tasks', p], queryFn: () => get<TaskDashboard>('/dashboard/tasks', p), placeholderData: (prev) => prev, refetchInterval: 60_000 });

export const useSyncStatus = () =>
  useQuery({ queryKey: ['sync'], queryFn: () => get<SyncState>('/sync/status'), refetchInterval: (q) => (q.state.data?.status === 'running' ? 1500 : 10_000) });

export function useRunSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/sync/run', { method: 'POST' });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? res.statusText);
      return res.json() as Promise<SyncState>;
    },
    onSettled: () => void qc.invalidateQueries(),
  });
}
