import { useEffect } from "react";
import useSWR from "swr";
import { supabase } from "@/services/supabase";
import { badgeService } from "@/services/badges";

export function useBadges(kidId?: string) {
  const { data, error, mutate } = useSWR(
    kidId ? `badges-progress-${kidId}` : null,
    () => badgeService.getAllBadgesWithProgress(kidId!),
  );

  // Real-time: re-fetch when admin changes badges OR when kid earns a new badge
  useEffect(() => {
    const sub = supabase
      .channel("badges-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "badges" },
        () => {
          mutate();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "kid_badges" },
        () => {
          mutate();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [mutate]);

  return {
    badges: data || [],
    loading: !error && !data,
    error,
    refresh: mutate,
  };
}
