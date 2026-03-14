import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// POST /functions/v1/push-send
// Sends push notifications via Expo Push API.
// Body: { title_en, title_ar, body_en, body_ar, segment?, data? }
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { title_en, title_ar, body_en, body_ar, segment, data, timezones } =
      await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Get active device tokens — filter by timezone if provided
    let query = supabase
      .from("device_tokens")
      .select("token, family_id, kid_id")
      .eq("is_active", true);

    if (timezones && Array.isArray(timezones) && timezones.length > 0) {
      query = query.in("timezone", timezones);
    }

    const { data: tokens, error: tokErr } = await query;

    if (tokErr) {
      return new Response(JSON.stringify({ sent: 0, error: tokErr.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tokens?.length) {
      return new Response(
        JSON.stringify({ sent: 0, reason: "no_matching_tokens" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Deduplicate by token
    const seen = new Set<string>();
    const uniqueTokens = tokens.filter((t) => {
      if (seen.has(t.token)) return false;
      seen.add(t.token);
      return true;
    });

    // 2. Build messages — send bilingual (Arabic title/body preferred, fallback to EN)
    const messages = uniqueTokens.map((t) => ({
      to: t.token,
      title: title_ar || title_en,
      body: body_ar || body_en,
      data: data || {},
      sound: "default",
    }));

    // 3. Send via Expo Push API (batch of 100)
    let totalSent = 0;
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(batch),
      });

      if (res.ok) totalSent += batch.length;
    }

    // 4. Log notification
    await supabase.from("notifications").insert({
      title_en,
      title_ar,
      body_en,
      body_ar,
      target_segment: segment || {},
      sent_at: new Date().toISOString(),
      stats: { sent: totalSent, delivered: 0, opened: 0, tapped: 0 },
    });

    return new Response(
      JSON.stringify({
        sent: totalSent,
        total_tokens: uniqueTokens.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ sent: 0, error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
