import useSWR from "swr";
import { dailyGoalsService } from "@/services/daily-goals";

export function useDailyGoal(kidId?: string) {
  const { data, error, mutate } = useSWR(
    kidId ? `daily-goal-${kidId}` : null,
    () => dailyGoalsService.getTodayGoal(kidId!)
  );
  return {
    goal: data,
    completed: data?.completed_count || 0,
    target: data?.target_count || 15,
    isComplete: data?.is_complete || false,
    loading: !error && !data,
    error,
    refresh: mutate,
  };
}
