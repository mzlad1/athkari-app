import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── GET: Fetch kid progress ──
    if (req.method === "GET") {
      const url = new URL(req.url);
      const kidId = url.searchParams.get("kid_id");
      if (!kidId) return new Response(JSON.stringify({ error: "kid_id required" }), { status: 400, headers: cors });

      // Get kid data
      const { data: kid } = await supabase
        .from("kids")
        .select("id, name, avatar, stars, streak, engagement_score, total_adhkar, daily_goal, last_active")
        .eq("id", kidId)
        .single();

      // Get today's wird log
      const today = new Date().toISOString().split("T")[0];
      const { data: wirdLogs } = await supabase
        .from("wird_logs")
        .select("*")
        .eq("kid_id", kidId)
        .gte("completed_at", today);

      // Get today's daily goal
      const { data: dailyGoal } = await supabase
        .from("daily_goals")
        .select("*")
        .eq("kid_id", kidId)
        .eq("goal_date", today)
        .single();

      // Get badges
      const { data: badges } = await supabase
        .from("kid_badges")
        .select("*, badge:badges(*)")
        .eq("kid_id", kidId);

      return new Response(
        JSON.stringify({
          kid,
          today: {
            wirdCompleted: wirdLogs?.length || 0,
            dailyGoal: dailyGoal || { target_count: kid?.daily_goal || 15, completed_count: 0 },
          },
          badges: badges || [],
        }),
        { headers: cors }
      );
    }

    // ── POST: Record dhikr completion ──
    if (req.method === "POST") {
      const { kid_id, adhkar_id, category_id, points_earned } = await req.json();
      if (!kid_id || !adhkar_id) {
        return new Response(JSON.stringify({ error: "kid_id and adhkar_id required" }), { status: 400, headers: cors });
      }

      const today = new Date().toISOString().split("T")[0];

      // 1. Log the wird completion
      await supabase.from("wird_logs").insert({
        kid_id,
        wird_template_id: null, // individual dhikr, not assigned wird
        completed_at: new Date().toISOString(),
      });

      // 2. Update kid stars + total_adhkar + last_active
      const { data: kid } = await supabase
        .from("kids")
        .select("stars, total_adhkar")
        .eq("id", kid_id)
        .single();

      const newStars = (kid?.stars || 0) + (points_earned || 5);
      const newTotal = (kid?.total_adhkar || 0) + 1;

      await supabase
        .from("kids")
        .update({
          stars: newStars,
          total_adhkar: newTotal,
          last_active: new Date().toISOString(),
        })
        .eq("id", kid_id);

      // 3. Update daily goal
      const { data: dailyGoal } = await supabase
        .from("daily_goals")
        .select("*")
        .eq("kid_id", kid_id)
        .eq("goal_date", today)
        .single();

      let goalComplete = false;
      if (dailyGoal) {
        const newCompleted = dailyGoal.completed_count + 1;
        goalComplete = newCompleted >= dailyGoal.target_count;
        await supabase
          .from("daily_goals")
          .update({
            completed_count: newCompleted,
            is_complete: goalComplete,
          })
          .eq("id", dailyGoal.id);
      } else {
        // Auto-create today's goal
        const { data: kidGoal } = await supabase
          .from("kids")
          .select("daily_goal")
          .eq("id", kid_id)
          .single();

        const target = kidGoal?.daily_goal || 15;
        goalComplete = 1 >= target;
        await supabase.from("daily_goals").insert({
          kid_id,
          goal_date: today,
          target_count: target,
          completed_count: 1,
          is_complete: goalComplete,
        });
      }

      // 4. Check badge eligibility
      const { data: allBadges } = await supabase.from("badges").select("*").eq("is_active", true);
      const { data: earnedBadges } = await supabase
        .from("kid_badges")
        .select("badge_id")
        .eq("kid_id", kid_id);

      const earnedIds = new Set((earnedBadges || []).map((b: any) => b.badge_id));
      const newBadges: any[] = [];

      for (const badge of allBadges || []) {
        if (earnedIds.has(badge.id)) continue;
        let earned = false;
        if (badge.criteria_type === "dhikr_count" && newTotal >= badge.threshold) earned = true;
        if (badge.criteria_type === "stars" && newStars >= badge.threshold) earned = true;
        // streak and wird_count checked by streak-check and wird-assign functions

        if (earned) {
          await supabase.from("kid_badges").insert({ kid_id, badge_id: badge.id });
          newBadges.push(badge);
        }
      }

      return new Response(
        JSON.stringify({
          stars: newStars,
          totalAdhkar: newTotal,
          goalComplete,
          goalMessage: goalComplete
            ? { ar: "🎉 أكملت هدف اليوم!", en: "🎉 Daily goal complete!" }
            : {
                ar: `باقي ${(dailyGoal?.target_count || 15) - ((dailyGoal?.completed_count || 0) + 1)} للهدف`,
                en: `${(dailyGoal?.target_count || 15) - ((dailyGoal?.completed_count || 0) + 1)} left for goal`,
              },
          newBadges,
        }),
        { headers: cors }
      );
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: cors });
  }
});
