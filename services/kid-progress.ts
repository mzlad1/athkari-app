import { supabase } from "./supabase";

export const kidProgressService = {
  /** Get full kid progress report — calls Edge Function */
  async getProgress(kidId: string) {
    const { data, error } = await supabase.functions.invoke("kid-progress", {
      body: { kid_id: kidId },
    });
    if (error) throw error;
    return data; // comprehensive progress report
  },

  /** Get kid's stats summary */
  async getStats(kidId: string) {
    const today = new Date().toISOString().split("T")[0];

    // Run ALL queries in parallel
    const [kidRes, goalRes, wirdRes, challengeRes, badgeRes, friendRes] =
      await Promise.all([
        supabase
          .from("kids")
          .select("stars, streak, total_adhkar, daily_goal, last_active")
          .eq("id", kidId)
          .single(),
        supabase
          .from("daily_goals")
          .select("completed_count, target_count, is_complete")
          .eq("kid_id", kidId)
          .eq("goal_date", today)
          .single(),
        supabase
          .from("wird_logs")
          .select("is_complete")
          .eq("kid_id", kidId)
          .eq("log_date", today)
          .single(),
        supabase
          .from("challenge_participants")
          .select("challenge_id, contribution")
          .eq("kid_id", kidId),
        supabase
          .from("kid_badges")
          .select("badge_id", { count: "exact", head: true })
          .eq("kid_id", kidId),
        supabase
          .from("friendships")
          .select("id", { count: "exact", head: true })
          .eq("kid_id", kidId),
      ]);

    const kid = kidRes.data;
    return {
      ...kid,
      todayGoal: goalRes.data || {
        completed_count: 0,
        target_count: kid?.daily_goal || 15,
        is_complete: false,
      },
      wirdComplete: wirdRes.data?.is_complete || false,
      activeChallenges: challengeRes.data?.length || 0,
      badgeCount: badgeRes.count || 0,
      friendCount: friendRes.count || 0,
    };
  },

  /** Update kid's last active timestamp */
  async updateLastActive(kidId: string) {
    await supabase
      .from("kids")
      .update({ last_active: new Date().toISOString() })
      .eq("id", kidId);
  },
};
