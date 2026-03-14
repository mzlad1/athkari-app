import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Daily Goal Edge Function — BRD §5.4
 *
 * - GET: Returns today's goal progress for a kid
 * - POST: Increments progress when dhikr is completed
 * - Triggers celebration when goal is met
 *
 * Default goal: 15 dhikr/day (configurable from parent dashboard: 5/10/15/20/30)
 */
serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { kid_id, action } = await req.json();
  const today = new Date().toISOString().split("T")[0];

  // Get or create today's goal
  let { data: goal } = await supabase
    .from("daily_goals")
    .select("*")
    .eq("kid_id", kid_id)
    .eq("goal_date", today)
    .single();

  if (!goal) {
    const { data: kid } = await supabase
      .from("kids")
      .select("daily_goal")
      .eq("id", kid_id)
      .single();

    const { data: newGoal } = await supabase
      .from("daily_goals")
      .insert({
        kid_id,
        goal_date: today,
        target_count: kid?.daily_goal || 15,
      })
      .select()
      .single();

    goal = newGoal;
  }

  if (action === "increment") {
    const newCount = (goal!.completed_count || 0) + 1;
    const isComplete = newCount >= goal!.target_count;

    await supabase
      .from("daily_goals")
      .update({ completed_count: newCount, is_complete: isComplete })
      .eq("id", goal!.id);

    // Increment total_adhkar directly (no RPC needed)
    const { data: kidData } = await supabase
      .from("kids")
      .select("total_adhkar")
      .eq("id", kid_id)
      .single();

    await supabase
      .from("kids")
      .update({
        total_adhkar: (kidData?.total_adhkar || 0) + 1,
        last_active: new Date().toISOString(),
      })
      .eq("id", kid_id);

    return new Response(
      JSON.stringify({
        completed: newCount,
        target: goal!.target_count,
        is_complete: isComplete,
        celebration: isComplete && newCount === goal!.target_count,
        message_ar: isComplete
          ? "🎉 أكملت هدف اليوم!"
          : `باقي ${goal!.target_count - newCount} للهدف`,
        message_en: isComplete
          ? "🎉 Daily goal complete!"
          : `${goal!.target_count - newCount} more to go`,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  // Default: return current progress
  return new Response(
    JSON.stringify({
      completed: goal!.completed_count || 0,
      target: goal!.target_count,
      is_complete: goal!.is_complete || false,
      message_ar: goal!.is_complete
        ? "🎉 أكملت هدف اليوم!"
        : `باقي ${goal!.target_count - (goal!.completed_count || 0)} للهدف`,
      message_en: goal!.is_complete
        ? "🎉 Daily goal complete!"
        : `${goal!.target_count - (goal!.completed_count || 0)} more to go`,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
