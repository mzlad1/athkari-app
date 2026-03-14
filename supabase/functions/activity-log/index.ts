import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * POST /functions/v1/activity-log
 * Called when a kid completes a dhikr or wird item.
 * Awards points, updates stars, checks streak, triggers badge evaluation.
 *
 * Body: { kid_id, adhkar_id, category_id, repetitions_done }
 */
serve(async (req) => {
  try {
    const { kid_id, adhkar_id, category_id, repetitions_done } =
      await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Get adhkar to calculate points
    const { data: dhikr } = await supabase
      .from("adhkar")
      .select("points, repetition_count")
      .eq("id", adhkar_id)
      .single();

    if (!dhikr)
      return new Response(JSON.stringify({ error: "Dhikr not found" }), {
        status: 404,
        headers: JSON_HEADERS,
      });

    // 2. Get gamification config (optional — use defaults if not configured)
    const { data: gamConfig } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "gamification")
      .maybeSingle();

    const config = gamConfig?.value || { pointsPerDhikr: 5, maxDaily: 500 };
    const earnedPoints = Math.min(dhikr.points * (repetitions_done || 1), 200); // cap per dhikr

    // 3. Get kid's current stats
    const { data: kid } = await supabase
      .from("kids")
      .select("stars, streak, streak_updated_at, total_adhkar")
      .eq("id", kid_id)
      .single();

    if (!kid)
      return new Response(JSON.stringify({ error: "Kid not found" }), {
        status: 404,
        headers: JSON_HEADERS,
      });

    // 4. Check daily point cap (anti-gaming)
    const today = new Date().toISOString().split("T")[0];
    const { data: todayLogs } = await supabase
      .from("wird_logs")
      .select("bonus_awarded")
      .eq("kid_id", kid_id)
      .eq("log_date", today);

    const todayTotal = (todayLogs || []).reduce(
      (sum, l) => sum + (l.bonus_awarded || 0),
      0,
    );
    const cappedPoints = Math.min(
      earnedPoints,
      (config.maxDaily || 500) - todayTotal,
    );

    if (cappedPoints <= 0) {
      return new Response(
        JSON.stringify({
          success: true,
          points_earned: 0,
          reason: "daily_cap_reached",
          total_stars: kid.stars,
        }),
        { headers: JSON_HEADERS },
      );
    }

    // 5. Award stars + increment total_adhkar
    const newStars = kid.stars + cappedPoints;
    const newTotalAdhkar = (kid.total_adhkar || 0) + 1;
    await supabase
      .from("kids")
      .update({
        stars: newStars,
        total_adhkar: newTotalAdhkar,
        last_active: new Date().toISOString(),
      })
      .eq("id", kid_id);

    // 6. Update/create today's wird log
    const { data: existingLog } = await supabase
      .from("wird_logs")
      .select("id, completed_items, bonus_awarded")
      .eq("kid_id", kid_id)
      .eq("log_date", today)
      .maybeSingle();

    const completedItem = {
      adhkar_id,
      completed_count: repetitions_done || 1,
      completed_at: new Date().toISOString(),
    };

    if (existingLog) {
      const items = [...(existingLog.completed_items || []), completedItem];
      await supabase
        .from("wird_logs")
        .update({
          completed_items: items,
          bonus_awarded: (existingLog.bonus_awarded || 0) + cappedPoints,
        })
        .eq("id", existingLog.id);
    } else {
      await supabase.from("wird_logs").insert({
        kid_id,
        log_date: today,
        completed_items: [completedItem],
        bonus_awarded: cappedPoints,
      });
    }

    // 7. Trigger badge evaluation (fire-and-forget)
    const badgeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/badge-evaluate`;
    fetch(badgeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ kid_id, new_stars: newStars }),
    }).catch(() => {}); // don't await, don't fail

    return new Response(
      JSON.stringify({
        success: true,
        points_earned: cappedPoints,
        total_stars: newStars,
        streak: kid.streak,
      }),
      { headers: JSON_HEADERS },
    );
  } catch (err) {
    console.error("activity-log error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
