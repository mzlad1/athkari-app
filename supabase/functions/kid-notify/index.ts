import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * POST /functions/v1/kid-notify
 *
 * Stores a notification in kid_notifications and sends a push notification.
 *
 * Body: {
 *   to_kid_id: string,          — target kid
 *   type: string,                — notification type (see below)
 *   title_ar: string,
 *   title_en: string,
 *   body_ar: string,
 *   body_en: string,
 *   data?: object,               — extra data (from_kid_id, challenge_id, etc.)
 * }
 *
 * Types: friend_request, friend_accepted, reaction, challenge_invite,
 *        challenge_accepted, challenge_won, badge_earned
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const {
      to_kid_id,
      type,
      title_ar,
      title_en,
      body_ar,
      body_en,
      data: extraData,
    } = await req.json();

    if (!to_kid_id || !type) {
      return new Response(
        JSON.stringify({ error: "to_kid_id and type are required" }),
        { status: 200, headers: CORS },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Insert in-app notification (service_role bypasses RLS)
    await supabaseAdmin.from("kid_notifications").insert({
      kid_id: to_kid_id,
      type,
      title_ar: title_ar || "",
      title_en: title_en || "",
      body_ar: body_ar || "",
      body_en: body_en || "",
      data: extraData || {},
    });

    // 2. Get push tokens for this kid
    const { data: tokens } = await supabaseAdmin
      .from("device_tokens")
      .select("token")
      .eq("kid_id", to_kid_id)
      .eq("is_active", true);

    // Deduplicate tokens (shared device may create multiple rows)
    const uniqueTokens = [...new Set((tokens || []).map((t: any) => t.token))];

    if (uniqueTokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, push_sent: false, reason: "no_token" }),
        { status: 200, headers: CORS },
      );
    }

    // 3. Send push via Expo
    const messages = uniqueTokens.map((token: string) => ({
      to: token,
      title: title_ar, // AR default — kid app is typically AR
      body: body_ar,
      data: { type, ...extraData },
      sound: "default",
    }));

    const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    const pushResult = await pushRes.json();

    return new Response(
      JSON.stringify({ success: true, push_sent: true, push: pushResult }),
      { status: 200, headers: CORS },
    );
  } catch (err: any) {
    console.error("kid-notify error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200,
      headers: CORS,
    });
  }
});
