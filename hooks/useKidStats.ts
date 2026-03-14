import useSWR from "swr";
import { kidProgressService } from "@/services/kid-progress";

export function useKidStats(kidId?: string) {
  const { data, error, mutate } = useSWR(
    kidId ? `kid-stats-${kidId}` : null,
    () => kidProgressService.getStats(kidId!),
    { refreshInterval: 60000 }, // Refresh every minute
  );
  return {
    stats: data,
    loading: !error && !data,
    error,
    refresh: mutate,
  };
}
