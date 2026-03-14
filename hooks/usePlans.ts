import { useEffect } from "react";
import useSWR from "swr";
import { supabase } from "@/services/supabase";
import { plansService } from "@/services/plans";

export function usePlans() {
  const { data, error, mutate } = useSWR("plans", () =>
    plansService.getPlans(),
  );

  // Real-time: re-fetch when admin changes subscription plans
  useEffect(() => {
    const sub = supabase
      .channel("plans-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plans" },
        () => {
          mutate();
        },
      )
      .subscribe();
    return () => {
      sub.unsubscribe();
    };
  }, [mutate]);

  return {
    plans: data || [],
    loading: !error && !data,
    error,
    refresh: mutate,
  };
}
