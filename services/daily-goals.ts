import { supabase } from "./supabase";

export const dailyGoalsService = {
  /** Get or create today's goal for a kid */
  async getTodayGoal(kidId: string) {
    const today = new Date().toISOString().split("T")[0];

    let { data } = await supabase
      .from("daily_goals")
      .select("*")
      .eq("kid_id", kidId)
      .eq("goal_date", today)
      .single();

    if (!data) {
      // Get kid's configured goal
      const { data: kid } = await supabase
        .from("kids")
        .select("daily_goal")
        .eq("id", kidId)
        .single();

      const { data: created } = await supabase
        .from("daily_goals")
        .insert({
          kid_id: kidId,
          goal_date: today,
          target_count: kid?.daily_goal || 15,
        })
        .select()
        .single();

      data = created;
    }

    return data;
  },

  /** Increment completed count (auto-creates row if missing) */
  async incrementProgress(kidId: string) {
    const today = new Date().toISOString().split("T")[0];

    let { data: goal } = await supabase
      .from("daily_goals")
      .select("*")
      .eq("kid_id", kidId)
      .eq("goal_date", today)
      .single();

    if (!goal) {
      // Auto-create the daily goal row so the increment isn't lost
      const { data: kid } = await supabase
        .from("kids")
        .select("daily_goal")
        .eq("id", kidId)
        .single();

      const { data: created } = await supabase
        .from("daily_goals")
        .insert({
          kid_id: kidId,
          goal_date: today,
          target_count: kid?.daily_goal || 15,
        })
        .select()
        .single();

      goal = created;
    }

    if (!goal) return;

    const newCount = (goal.completed_count || 0) + 1;
    const isComplete = newCount >= goal.target_count;

    await supabase
      .from("daily_goals")
      .update({ completed_count: newCount, is_complete: isComplete })
      .eq("id", goal.id);

    return { completed: newCount, target: goal.target_count, isComplete };
  },

  /** Parent updates daily goal target */
  async updateGoalTarget(kidId: string, target: number) {
    const today = new Date().toISOString().split("T")[0];
    // Update the kid's default goal for future days
    await supabase.from("kids").update({ daily_goal: target }).eq("id", kidId);
    // Also update today's already-created row so home screen reflects it immediately
    await supabase
      .from("daily_goals")
      .update({ target_count: target })
      .eq("kid_id", kidId)
      .eq("goal_date", today);
  },
};
