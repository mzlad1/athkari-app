import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * POST /functions/v1/streak-check
 *
 * Client-only streak evaluation. Body: { kid_id }
 *
 * Rules:
 *   - Finish daily wird → streak + 1 (or 1 if chain was broken)
 *   - Miss a day (no completed wird) → streak resets to 0
 *   - Each day's increment can only happen once (idempotent)
 *
 * Called in two situations:
 *   1. After wird completion  → detects "today is done" and increments
 *   2. On app open            → detects missed days and resets if needed
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let kidId: string | null = null;
    try {
      const body = await req.json();
      kidId = body?.kid_id || null;
    } catch {
      // empty body
    }

    if (!kidId) {
      return new Response(JSON.stringify({ error: "kid_id is required" }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    const { data: kid } = await supabase
      .from("kids")
      .select("id, streak, streak_updated_at, family_id")
      .eq("id", kidId)
      .single();

    if (!kid) {
      return new Response(JSON.stringify({ error: "Kid not found" }), {
        status: 404,
        headers: CORS_HEADERS,
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split("T")[0];
    const currentStreak = kid.streak || 0;

    // If we already incremented today (streak > 0 and date = today), skip.
    // But if streak is 0 and date = today, the user may have completed wird
    // AFTER an earlier reset — we must re-check.
    if (kid.streak_updated_at === today && currentStreak > 0) {
      return respond(currentStreak, today, "maintained");
    }

    // Check if wird is complete for today
    const { data: todayLog } = await supabase
      .from("wird_logs")
      .select("is_complete")
      .eq("kid_id", kidId)
      .eq("log_date", today)
      .maybeSingle();

    const todayDone = todayLog?.is_complete === true;

    if (todayDone) {
      // Wird done today — check continuity
      if (kid.streak_updated_at === yesterday) {
        // Consecutive day → increment
        const newStreak = currentStreak + 1;
        await updateStreak(supabase, kidId, newStreak, today);
        await awardMilestoneBonus(supabase, kidId, newStreak);
        return respond(newStreak, today, "incremented");
      }

      // Gap (or same-day after reset) → fresh start at 1
      if (currentStreak >= 3) {
        await notifyStreakLost(supabase, kidId, currentStreak);
      }
      await updateStreak(supabase, kidId, 1, today);
      return respond(1, today, "started");
    }

    // ── Wird NOT done today ──

    // Last update was yesterday → user still has the rest of today to finish
    if (kid.streak_updated_at === yesterday) {
      return respond(currentStreak, kid.streak_updated_at, "maintained");
    }

    // Already processed today (reset earlier) → still waiting for wird
    if (kid.streak_updated_at === today) {
      return respond(currentStreak, today, "maintained");
    }

    // Last update was 2+ days ago → reset to 0
    if (currentStreak > 0) {
      if (currentStreak >= 3) {
        await notifyStreakLost(supabase, kidId, currentStreak);
      }
      await updateStreak(supabase, kidId, 0, today);
      return respond(0, today, "reset");
    }

    // Already 0, just stamp today so we don't re-check every time
    await updateStreak(supabase, kidId, 0, today);
    return respond(0, today, "maintained");
  } catch (err) {
    console.error("streak-check error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      { status: 500, headers: CORS_HEADERS },
    );
  }
});

function respond(streak: number, updatedAt: string, result: string) {
  return new Response(
    JSON.stringify({ streak, streak_updated_at: updatedAt, result }),
    { headers: CORS_HEADERS },
  );
}

async function updateStreak(
  supabase: any,
  kidId: string,
  streak: number,
  date: string,
) {
  await supabase
    .from("kids")
    .update({ streak, streak_updated_at: date })
    .eq("id", kidId);
}

async function awardMilestoneBonus(
  supabase: any,
  kidId: string,
  newStreak: number,
) {
  const milestones: Record<number, number> = { 7: 50, 30: 200, 100: 500 };
  const bonus = milestones[newStreak];
  if (!bonus) return;

  const { data: kidData } = await supabase
    .from("kids")
    .select("stars")
    .eq("id", kidId)
    .single();

  await supabase
    .from("kids")
    .update({ stars: (kidData?.stars || 0) + bonus })
    .eq("id", kidId);
}

async function notifyStreakLost(
  supabase: any,
  kidId: string,
  oldStreak: number,
) {
  const { data: tokens } = await supabase
    .from("device_tokens")
    .select("token")
    .eq("kid_id", kidId)
    .eq("is_active", true);

  const uniqueTokens = [...new Set((tokens || []).map((t: any) => t.token))];
  if (uniqueTokens.length) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: uniqueTokens,
        title: "😢 Streak Lost!",
        body: `Your ${oldStreak}-day streak was reset. Start a new one today!`,
        data: { type: "streak_lost" },
      }),
    }).catch(() => {});
  }
}
