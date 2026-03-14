import { useState, useEffect } from "react";
import { supabase } from "@/services/supabase";

export interface VoiceFile {
  id: number;
  profile_id: number;
  adhkar_id: number;
  storage_path: string;
  public_url: string;
  duration_seconds: number | null;
  generated_at: string;
  created_at: string;
}

/**
 * Fetches a voice file for a specific dhikr + voice profile combination.
 * Returns null if no file exists.
 */
export function useVoiceFile(
  adhkarId: number | null | undefined,
  profileId: number | null | undefined,
) {
  const [voiceFile, setVoiceFile] = useState<VoiceFile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!adhkarId || !profileId) {
      setVoiceFile(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from("voice_files")
      .select("*")
      .eq("adhkar_id", adhkarId)
      .eq("profile_id", profileId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setVoiceFile(data ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [adhkarId, profileId]);

  return { voiceFile, loading };
}
