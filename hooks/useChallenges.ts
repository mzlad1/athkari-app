import { useEffect } from "react";
import useSWR from "swr";
import { challengesService } from "@/services/challenges";
import { supabase } from "@/services/supabase";

export function useChallenges() {
  const { data, error, mutate } = useSWR(
    "challenges",
    () => challengesService.getChallenges(),
    { dedupingInterval: 5000 },
  );

  // Real-time: re-fetch when any challenge row changes (status, etc.)
  useEffect(() => {
    const channel = supabase
      .channel("challenges-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "challenges" },
        () => {
          mutate();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "challenge_participants" },
        () => {
          mutate();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [mutate]);

  return {
    challenges: data || [],
    loading: !error && !data,
    error,
    refresh: mutate,
  };
}

export function useLeaderboard(kidId?: string) {
  const { data, error, mutate } = useSWR(
    kidId ? `leaderboard-${kidId}` : null,
    () => challengesService.getLeaderboard(kidId!),
    { dedupingInterval: 5000 },
  );
  return {
    leaderboard: data || [],
    loading: !error && !data,
    error,
    refresh: mutate,
  };
}

export function useChallengeTemplates() {
  const { data, error, mutate } = useSWR(
    "challenge-templates",
    () => challengesService.getTemplates(),
    { dedupingInterval: 10000 },
  );
  return {
    templates: data || [],
    loading: !error && !data,
    error,
    refresh: mutate,
  };
}
