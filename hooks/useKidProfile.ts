import { useState, useEffect } from "react";
import { supabase } from "@/services/supabase";
import type { Kid, Badge } from "@/types/database";

export function useKidProfile(kidId: string | null) {
  const [kid, setKid] = useState<Kid | null>(null);
  const [badges, setBadges] = useState<(Badge & { unlocked_at: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!kidId) return;
    fetchProfile();
  }, [kidId]);

  async function fetchProfile() {
    setLoading(true);

    // Get kid data
    const { data: kidData } = await supabase
      .from("kids")
      .select("*")
      .eq("id", kidId)
      .single();

    if (kidData) setKid(kidData);

    // Get earned badges
    const { data: badgeData } = await supabase
      .from("kid_badges")
      .select("unlocked_at, badges(*)")
      .eq("kid_id", kidId);

    if (badgeData) {
      setBadges(
        badgeData.map((b) => {
          const badge = b.badges as unknown as Badge;
          return { ...badge, unlocked_at: b.unlocked_at };
        }),
      );
    }

    setLoading(false);
  }

  return { kid, badges, loading, refresh: fetchProfile };
}
