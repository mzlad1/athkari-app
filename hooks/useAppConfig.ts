import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/services/supabase";

export interface AppConfig {
  maintenance_mode: boolean;
  maintenance_msg: string;
  min_app_version: string;
  force_update: boolean;
  default_lang: "ar" | "en";
  max_friends_per_kid: number;
}

const DEFAULTS: AppConfig = {
  maintenance_mode: false,
  maintenance_msg: "",
  min_app_version: "1.0.0",
  force_update: false,
  default_lang: "ar",
  max_friends_per_kid: 20,
};

const CONFIG_KEYS: (keyof AppConfig)[] = [
  "maintenance_mode",
  "maintenance_msg",
  "min_app_version",
  "force_update",
  "default_lang",
  "max_friends_per_kid",
];

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_config")
        .select("key, value")
        .in("key", CONFIG_KEYS);

      if (!error && data) {
        const merged = { ...DEFAULTS };
        for (const row of data) {
          if (row.key in merged) {
            (merged as any)[row.key] = row.value;
          }
        }
        setConfig(merged);
      }
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();

    // ── Real-time subscription ──
    // When admin changes any config (e.g. turns on maintenance mode),
    // all open apps receive the update instantly.
    const channel = supabase
      .channel("app_config_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_config" },
        (payload) => {
          const row = payload.new as { key: string; value: any } | undefined;
          if (row && CONFIG_KEYS.includes(row.key as keyof AppConfig)) {
            setConfig((prev) => ({ ...prev, [row.key]: row.value }));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConfig]);

  return { config, loading, refresh: fetchConfig };
}

