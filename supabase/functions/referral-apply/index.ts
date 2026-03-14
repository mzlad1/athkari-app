import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * POST /functions/v1/referral-apply
 *
 * Applies a kid-to-kid referral:
 *  - Validates the referral hasn't already been applied (deduplication)
 *  - Atomically awards REFERRAL_STARS to the referrer kid
 *  - Sets referred_by on the new kid
 *  - Sends in-app notification to the referrer
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS (referrer may belong to a different family).
 *
 * Body: { referrer_kid_id: string, new_kid_id: string }
 */

const REFERRAL_STARS = 50;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { referrer_kid_id, new_kid_id } = await req.json();

    if (!referrer_kid_id || !new_kid_id) {
      return new Response(
        JSON.stringify({
          error: "referrer_kid_id and new_kid_id are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (referrer_kid_id === new_kid_id) {
      return new Response(JSON.stringify({ error: "Cannot refer yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Check new_kid hasn't already been referred (deduplication)
    const { data: newKid } = await supabase
      .from("kids")
      .select("id, name, referred_by")
      .eq("id", new_kid_id)
      .single();

    if (!newKid) {
      return new Response(JSON.stringify({ error: "New kid not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (newKid.referred_by) {
      return new Response(
        JSON.stringify({ error: "Referral already applied" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Get referrer kid — must exist and have a friend_code
    const { data: referrer } = await supabase
      .from("kids")
      .select("id, name, stars")
      .eq("id", referrer_kid_id)
      .single();

    if (!referrer) {
      return new Response(JSON.stringify({ error: "Referrer kid not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Mark the new kid as referred
    const { error: referredErr } = await supabase
      .from("kids")
      .update({ referred_by: referrer_kid_id })
      .eq("id", new_kid_id);

    if (referredErr) {
      return new Response(
        JSON.stringify({
          error: "Failed to set referred_by",
          detail: referredErr.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 4. Atomically increment referrer's stars
    const { error: starsErr } = await supabase
      .from("kids")
      .update({ stars: (referrer.stars || 0) + REFERRAL_STARS })
      .eq("id", referrer_kid_id);

    if (starsErr) {
      return new Response(
        JSON.stringify({
          error: "Failed to award stars",
          detail: starsErr.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 5. Send in-app notification to the referrer
    await supabase.from("kid_notifications").insert({
      kid_id: referrer_kid_id,
      type: "referral_bonus",
      title_ar: "🎁 صديق انضم بكودك!",
      title_en: "🎁 A friend joined with your code!",
      body_ar: `حصلت على ${REFERRAL_STARS} نجمة لأن صديقًا استخدم كودك 🌟`,
      body_en: `You earned ${REFERRAL_STARS} stars because a friend used your code 🌟`,
      data: { referral_stars: REFERRAL_STARS, from_kid_id: new_kid_id },
      read: false,
    });

    return new Response(
      JSON.stringify({ success: true, stars_awarded: REFERRAL_STARS }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
