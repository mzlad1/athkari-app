import { useState, useEffect, useCallback } from "react";
import {
  getLevelFromStars,
  getNextLevel,
  levelProgress,
  starsToNextLevel,
  type LevelDef,
} from "@/constants/levels";
import { notificationService } from "@/services/notifications";
import { levelsService } from "@/services/levels";
import { supabase } from "@/services/supabase";

/**
 * Level is now stored in DB (auto-computed by trigger when stars change).
 * `level_celebrated` tracks which level the kid already saw the celebration for.
 * Celebration fires once: when level > level_celebrated. Then we update level_celebrated.
 */
export function useLevel(kidId: string | undefined, stars: number) {
  const currentDef = getLevelFromStars(stars);
  const nextDef = getNextLevel(currentDef.level);
  const progress = levelProgress(stars);
  const remaining = starsToNextLevel(stars);

  const [justLeveledUp, setJustLeveledUp] = useState(false);
  const [newLevel, setNewLevel] = useState<LevelDef | null>(null);

  useEffect(() => {
    if (!kidId) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("kids")
        .select("level, level_celebrated")
        .eq("id", kidId)
        .single();

      if (cancelled || !data) return;

      const dbLevel = data.level ?? currentDef.level;
      const celebrated = data.level_celebrated ?? 1;

      if (dbLevel > celebrated) {
        const levelDef = getLevelFromStars(stars);
        setNewLevel(levelDef);
        setJustLeveledUp(true);

        notificationService
          .insertInAppNotification({
            toKidId: kidId,
            type: "level_up",
            titleAr: `🎉 مبروك! وصلت للمستوى ${levelDef.level}`,
            titleEn: `🎉 Level Up! You reached Level ${levelDef.level}`,
            bodyAr: `${levelDef.emoji} أنت الآن "${levelDef.titleAr}" — واصل التميز!`,
            bodyEn: `${levelDef.emoji} You are now a "${levelDef.titleEn}" — keep shining!`,
            data: { level: levelDef.level },
          })
          .catch(() => {});

        levelsService.markLevelCelebrated(kidId, dbLevel).catch(() => {});
      }
    })();

    return () => { cancelled = true; };
  }, [kidId, currentDef.level]);

  const dismissLevelUp = useCallback(() => {
    setJustLeveledUp(false);
    setNewLevel(null);
  }, []);

  return {
    level: currentDef,
    nextLevel: nextDef,
    progress,
    remaining,
    justLeveledUp,
    newLevel,
    dismissLevelUp,
  };
}
