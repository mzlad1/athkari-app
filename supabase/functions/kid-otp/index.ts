import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const OTP_EXPIRY_MINUTES = 5;

/**
 * POST /functions/v1/kid-otp
 * Two actions:
 *   action: "send"   — generate OTP, push-notify parent
 *   action: "verify"  — verify OTP, return session
 *
 * Body (send):   { action: "send", email: string }
 * Body (verify): { action: "verify", email: string, otp: string }
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: JSON_HEADERS });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ────────────────────────────────────────────
    // ACTION: SEND OTP
    // ────────────────────────────────────────────
    if (action === "send") {
      const { email } = body;
      if (!email) {
        return new Response(JSON.stringify({ error: "email is required" }), {
          status: 400,
          headers: JSON_HEADERS,
        });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // 1. Find the family by parent email
      const { data: family, error: famErr } = await supabase
        .from("families")
        .select("id, parent_name, auth_user_id")
        .eq("parent_email", normalizedEmail)
        .single();

      if (famErr || !family) {
        return new Response(JSON.stringify({ error: "no_family_found" }), {
          status: 200,
          headers: JSON_HEADERS,
        });
      }

      // 2. Generate a 6-digit OTP
      const otp = String(Math.floor(100000 + Math.random() * 900000));

      // 3. Delete any existing OTPs for this family (prevent duplicates)
      await supabase.from("kid_login_otps").delete().eq("family_id", family.id);

      // 4. Store OTP with expiry
      const expiresAt = new Date(
        Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
      ).toISOString();

      const { error: insertErr } = await supabase
        .from("kid_login_otps")
        .insert({
          family_id: family.id,
          otp_code: otp,
          expires_at: expiresAt,
        });

      if (insertErr) {
        return new Response(JSON.stringify({ error: "Failed to create OTP" }), {
          status: 500,
          headers: JSON_HEADERS,
        });
      }

      // 5. Get parent push tokens only (kid_id IS NULL) to avoid duplicates on shared device
      const { data: tokens } = await supabase
        .from("device_tokens")
        .select("token")
        .eq("family_id", family.id)
        .is("kid_id", null)
        .eq("is_active", true);

      if (!tokens || tokens.length === 0) {
        // No push tokens — OTP is created in DB, return success
        // Parent can check OTP from app or DB directly
        console.log(`OTP for family ${family.id}: ${otp} (no push token)`);
        return new Response(
          JSON.stringify({
            success: true,
            sent: 0,
            expires_in: OTP_EXPIRY_MINUTES,
            warning: "no_push_token",
          }),
          { headers: JSON_HEADERS },
        );
      }

      // 6. Send push notification via Expo Push API
      const messages = tokens.map((t) => ({
        to: t.token,
        title: "أذكاري | Athkari",
        subtitle: "🔐 طلب دخول طفلك",
        body: `رمز الدخول: ${otp}\nيرجى مشاركته مع طفلك خلال ${OTP_EXPIRY_MINUTES} دقائق.\n\nLogin code: ${otp}\nShare it with your child within ${OTP_EXPIRY_MINUTES} minutes.`,
        data: { type: "kid_otp", otp, family_id: family.id },
        sound: "default",
        priority: "high",
        channelId: "default",
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
        JSON.stringify({
          success: true,
          sent: tokens.length,
          expires_in: OTP_EXPIRY_MINUTES,
        }),
        { headers: JSON_HEADERS },
      );
    }

    // ────────────────────────────────────────────
    // ACTION: VERIFY OTP
    // ────────────────────────────────────────────
    if (action === "verify") {
      const { email, otp } = body;
      if (!email || !otp) {
        return new Response(
          JSON.stringify({ error: "email and otp are required" }),
          { status: 400, headers: JSON_HEADERS },
        );
      }

      const normalizedEmail = email.toLowerCase().trim();

      // 1. Find the family
      const { data: family } = await supabase
        .from("families")
        .select("id, auth_user_id")
        .eq("parent_email", normalizedEmail)
        .single();

      if (!family) {
        return new Response(JSON.stringify({ error: "no_family_found" }), {
          status: 200,
          headers: JSON_HEADERS,
        });
      }

      // 2. Find valid OTP
      const { data: otpRecord } = await supabase
        .from("kid_login_otps")
        .select("*")
        .eq("family_id", family.id)
        .eq("otp_code", otp)
        .gt("expires_at", new Date().toISOString())
        .eq("used", false)
        .single();

      if (!otpRecord) {
        return new Response(
          JSON.stringify({ error: "invalid_or_expired_otp" }),
          { status: 200, headers: JSON_HEADERS },
        );
      }

      // 3. Mark OTP as used
      await supabase
        .from("kid_login_otps")
        .update({ used: true })
        .eq("id", otpRecord.id);

      // 4. Generate a magic link / session for the parent's auth user
      //    This lets the kid's device get a valid Supabase session
      if (!family.auth_user_id) {
        return new Response(JSON.stringify({ error: "no_auth_user" }), {
          status: 200,
          headers: JSON_HEADERS,
        });
      }

      // Use admin API to generate a magic link for this user
      const { data: linkData, error: linkErr } =
        await supabase.auth.admin.generateLink({
          type: "magiclink",
          email: normalizedEmail,
        });

      if (linkErr || !linkData) {
        return new Response(
          JSON.stringify({ error: "session_creation_failed" }),
          { status: 500, headers: JSON_HEADERS },
        );
      }

      // Extract the token from the generated link properties
      const token_hash = linkData.properties?.hashed_token;

      return new Response(
        JSON.stringify({
          success: true,
          family_id: family.id,
          token_hash,
          email: normalizedEmail,
        }),
        { headers: JSON_HEADERS },
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'send' or 'verify'" }),
      { status: 400, headers: JSON_HEADERS },
    );
  } catch (err) {
    console.error("kid-otp error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      { status: 500, headers: JSON_HEADERS },
    );
  }
});
