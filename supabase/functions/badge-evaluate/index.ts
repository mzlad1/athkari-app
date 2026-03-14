import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * POST /functions/v1/badge-evaluate
 * Checks if a kid has earned any new badges.
 * Called after activity-log awards points.
 *
 * Body: { kid_id, new_stars? }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { kid_id, new_stars } = await req.json();

    if (!kid_id) {
      return new Response(JSON.stringify({ error: "kid_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Get kid's full stats
    const { data: kid } = await supabase
      .from("kids")
      .select("stars, streak, total_adhkar")
      .eq("id", kid_id)
      .single();

    if (!kid)
      return new Response(JSON.stringify({ error: "Kid not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const currentStars = new_stars ?? kid.stars;

    // 2. Count total completed wird logs as proxy for totalDhikr
    const { data: logs } = await supabase
      .from("wird_logs")
      .select("completed_items, is_complete")
      .eq("kid_id", kid_id);

    const totalDhikr = (logs || []).reduce((sum, log) => {
      return sum + (log.completed_items?.length || 0);
    }, 0);

    const totalWirds = (logs || []).filter((l) => l.is_complete).length;

    // 2b. Count friends
    const { data: friendships } = await supabase
      .from("friendships")
      .select("id")
      .eq("kid_id", kid_id);
    const friendCount = friendships?.length || 0;

    // 2c. Count distinct completed categories (via daily_goals or wird_logs)
    const { data: dailyGoals } = await supabase
      .from("daily_goals")
      .select("kid_id")
      .eq("kid_id", kid_id)
      .eq("is_complete", true);
    const completedCategoryCount = dailyGoals?.length || 0;

    // 3. Get badges kid hasn't earned yet
    const { data: earnedBadges } = await supabase
      .from("kid_badges")
      .select("badge_id")
      .eq("kid_id", kid_id);

    const earnedIds = new Set((earnedBadges || []).map((b) => b.badge_id));

    const { data: allBadges } = await supabase
      .from("badges")
      .select("*")
      .eq("is_active", true);

    // 4. Evaluate each unearned badge
    const newlyEarned = [];
    for (const badge of allBadges || []) {
      if (earnedIds.has(badge.id)) continue;

      let earned = false;
      switch (badge.criteria_type) {
        case "dhikr_count":
        case "total_adhkar":
          earned = (kid.total_adhkar || totalDhikr) >= badge.threshold;
          break;
        case "streak":
          earned = kid.streak >= badge.threshold;
          break;
        case "stars":
          earned = currentStars >= badge.threshold;
          break;
        case "wird_count":
          earned = totalWirds >= badge.threshold;
          break;
        case "friend_count":
          earned = friendCount >= badge.threshold;
          break;
        case "category_count":
          earned = completedCategoryCount >= badge.threshold;
          break;
      }

      if (earned) {
        const { error: insertErr } = await supabase.from("kid_badges").insert({
          kid_id,
          badge_id: badge.id,
        });
        if (!insertErr) {
          newlyEarned.push({
            id: badge.id,
            name_en: badge.name_en,
            name_ar: badge.name_ar,
            icon: badge.icon,
          });
        }
      }
    }

    // 5. Send push notification + in-app notification for new badges
    if (newlyEarned.length > 0) {
      const { data: tokens } = await supabase
        .from("device_tokens")
        .select("token")
        .eq("kid_id", kid_id)
        .eq("is_active", true);

      if (tokens?.length) {
        const uniqueTokens = [
          ...new Set(tokens.map((t: { token: string }) => t.token)),
        ];
        const badge = newlyEarned[0];
        fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: uniqueTokens,
            title: `${badge.icon} وسام جديد! / New Badge!`,
            body: badge.name_ar
              ? `حصلت على "${badge.name_ar}"! / You earned "${badge.name_en}"!`
              : `You earned "${badge.name_en}"!`,
            data: { type: "badge_earned", badge_id: badge.id },
          }),
        }).catch(() => {});
      }

      // Insert in-app notifications for each new badge (drives the bell icon)
      for (const b of newlyEarned) {
        supabase
          .from("kid_notifications")
          .insert({
            kid_id,
            type: "badge_earned",
            title_ar: `${b.icon} وسام جديد!`,
            title_en: `${b.icon} New Badge!`,
            body_ar: b.name_ar
              ? `حصلت على "${b.name_ar}"! 🎉`
              : `You earned "${b.name_en}"! 🎉`,
            body_en: `You earned "${b.name_en}"! 🎉`,
            data: { badge_id: b.id },
          })
          .then(() => {})
          .catch(() => {});
      }
    }

    return new Response(
      JSON.stringify({
        evaluated: (allBadges || []).length,
        newly_earned: newlyEarned,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("badge-evaluate error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
