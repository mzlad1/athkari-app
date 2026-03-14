import { supabase } from "./supabase";
import type { LevelDef } from "@/constants/levels";
import { LEVELS as FALLBACK_LEVELS } from "@/constants/levels";

let cachedLevels: LevelDef[] | null = null;

export const levelsService = {
  async fetchLevels(): Promise<LevelDef[]> {
    if (cachedLevels) return cachedLevels;

    const { data, error } = await supabase
      .from("levels")
      .select("level, stars_required, emoji, title_en, title_ar, gradient_start, gradient_end")
      .order("level", { ascending: true });

    if (error || !data || data.length === 0) {
      cachedLevels = FALLBACK_LEVELS;
      return FALLBACK_LEVELS;
    }

    cachedLevels = data.map((row) => ({
      level: row.level,
      starsRequired: row.stars_required,
      emoji: row.emoji,
      titleEn: row.title_en,
      titleAr: row.title_ar,
      gradient: [row.gradient_start, row.gradient_end] as [string, string],
    }));

    return cachedLevels;
  },

  getCachedLevels(): LevelDef[] {
    return cachedLevels || FALLBACK_LEVELS;
  },

  clearCache() {
    cachedLevels = null;
  },

  /** Mark level_celebrated = current level in DB so celebration won't repeat */
  async markLevelCelebrated(kidId: string, level: number) {
    await supabase
      .from("kids")
      .update({ level_celebrated: level })
      .eq("id", kidId);
  },
};
