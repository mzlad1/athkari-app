import useSWR from "swr";
import { notificationService } from "@/services/notifications";

export function useReactions(kidId?: string) {
  const { data, error, mutate } = useSWR(
    kidId ? `reactions-${kidId}` : null,
    () => notificationService.getUnreadReactions(kidId!),
    { refreshInterval: 30000 }, // Refresh every 30 seconds
  );
  return {
    reactions: data || [],
    unreadCount: data?.length || 0,
    loading: !error && !data,
    error,
    refresh: mutate,
  };
}
