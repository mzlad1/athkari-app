import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/services/supabase";

export interface VoiceProfile {
  id: number;
  name_ar: string;
  name_en: string;
  source: "upload" | "elevenlabs";
  elevenlabs_voice_id: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

/**
 * Fetches active voice profiles from Supabase.
 * RLS allows anon/authenticated reads for is_active = true profiles.
 */
export function useVoiceProfiles() {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("voice_profiles")
        .select(
          "id, name_ar, name_en, source, elevenlabs_voice_id, is_active, display_order, created_at",
        )
        .eq("is_active", true)
        .order("display_order");
      setProfiles((data as VoiceProfile[]) || []);
    } catch {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profiles, loading, refresh };
}
