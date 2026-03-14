import { supabase } from "./supabase";

export const badgeService = {
  /** Evaluate badges for a kid — calls Edge Function */
  async evaluateBadges(kidId: string) {
    const { data, error } = await supabase.functions.invoke("badge-evaluate", {
      body: { kid_id: kidId },
    });
    if (error) throw error;
    return data; // { new_badges: Badge[], total_badges: number }
  },

  /** Get all badges and kid's progress */
  async getAllBadgesWithProgress(kidId: string) {
    const [badgesRes, earnedRes, kidRes, friendsRes, wirdLogsRes] =
      await Promise.all([
        supabase
          .from("badges")
          .select("*")
          .eq("is_active", true)
          .order("display_order"),
        supabase
          .from("kid_badges")
          .select("badge_id, unlocked_at")
          .eq("kid_id", kidId),
        supabase
          .from("kids")
          .select("stars, streak, total_adhkar")
          .eq("id", kidId)
          .single(),
        supabase
          .from("friendships")
          .select("id")
          .eq("kid_id", kidId),
        supabase
          .from("wird_logs")
          .select("is_complete")
          .eq("kid_id", kidId)
          .eq("is_complete", true),
      ]);

    const allBadges = badgesRes.data;
    const earned = earnedRes.data;
    const kid = kidRes.data;
    const friendCount = friendsRes.data?.length || 0;
    const wirdCount = wirdLogsRes.data?.length || 0;

    const earnedSet = new Set(earned?.map((e) => e.badge_id) || []);
    const earnedMap = new Map(
      earned?.map((e) => [e.badge_id, e.unlocked_at]) || [],
    );

    return (allBadges || []).map((badge) => {
      const isEarned = earnedSet.has(badge.id);
      let progress = 0;

      if (kid && badge.threshold > 0) {
        switch (badge.criteria_type) {
          case "stars":
            progress = Math.min(100, (kid.stars / badge.threshold) * 100);
            break;
          case "streak":
            progress = Math.min(100, (kid.streak / badge.threshold) * 100);
            break;
          case "dhikr_count":
          case "total_adhkar":
            progress = Math.min(
              100,
              ((kid.total_adhkar || 0) / badge.threshold) * 100,
            );
            break;
          case "wird_count":
            progress = Math.min(100, (wirdCount / badge.threshold) * 100);
            break;
          case "friend_count":
            progress = Math.min(100, (friendCount / badge.threshold) * 100);
            break;
          case "category_count":
            progress = isEarned ? 100 : 0;
            break;
          default:
            progress = isEarned ? 100 : 0;
        }
      }

      return {
        ...badge,
        is_earned: isEarned,
        unlocked_at: earnedMap.get(badge.id) || null,
        progress: isEarned ? 100 : Math.round(progress),
      };
    });
  },
};
