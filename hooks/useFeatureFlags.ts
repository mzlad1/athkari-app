import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/services/supabase";
import { useFocusEffect } from "expo-router";

/** Default: all features ON so nothing breaks if config hasn't been set */
const DEFAULTS: Record<string, boolean> = {
  challenges: true,
  friends: true,
  wird: true,
  leaderboard: true,
  referrals: true,
  "1v1": true,
};

export type FeatureFlags = Record<string, boolean>;

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULTS);

  const fetchFlags = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "feature_flags")
        .single();
      if (!error && data?.value) {
        setFlags({ ...DEFAULTS, ...data.value });
      }
    } catch {
      // keep defaults
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  // Re-fetch when screen gains focus
  useFocusEffect(
    useCallback(() => {
      fetchFlags();
    }, [fetchFlags]),
  );

  return flags;
}
