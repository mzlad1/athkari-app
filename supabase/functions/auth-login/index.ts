import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { method, email, pin, kidId, otp } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Method 1: Parent email login ──
    if (method === "parent") {
      if (!email) return new Response(JSON.stringify({ error: "Email required" }), { status: 400, headers: cors });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: otp || "",
      });
      if (error) throw error;

      // Fetch family + kids
      const { data: family } = await supabase
        .from("families")
        .select("*, kids(*)")
        .eq("auth_user_id", data.user.id)
        .single();

      return new Response(JSON.stringify({ session: data.session, family }), { headers: cors });
    }

    // ── Method 2: Kid OTP login ──
    if (method === "kid_otp") {
      if (!email) return new Response(JSON.stringify({ error: "Parent email required" }), { status: 400, headers: cors });

      // Find family by email
      const { data: family } = await supabase
        .from("families")
        .select("id, email")
        .eq("email", email)
        .single();
      if (!family) return new Response(JSON.stringify({ error: "Family not found" }), { status: 404, headers: cors });

      // Generate 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Store OTP (in production: send via email, store in cache with TTL)
      await supabase.from("app_config").upsert({
        key: `otp:${family.id}`,
        value: JSON.stringify({ code: otpCode, expiresAt: Date.now() + 10 * 60 * 1000 }),
      });

      // In production: send email via SendGrid/SES
      return new Response(
        JSON.stringify({ message: "OTP sent to parent email", familyId: family.id }),
        { headers: cors }
      );
    }

    // ── Method 3: Verify OTP ──
    if (method === "verify_otp") {
      const { familyId, code } = { familyId: kidId, code: otp };
      const { data: otpData } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", `otp:${familyId}`)
        .single();

      if (!otpData) return new Response(JSON.stringify({ error: "No OTP found" }), { status: 400, headers: cors });

      const parsed = JSON.parse(otpData.value);
      if (parsed.code !== code || Date.now() > parsed.expiresAt) {
        return new Response(JSON.stringify({ error: "Invalid or expired OTP" }), { status: 401, headers: cors });
      }

      // Fetch kids for this family
      const { data: kids } = await supabase
        .from("kids")
        .select("id, name, avatar, age_group")
        .eq("family_id", familyId);

      // Clean up OTP
      await supabase.from("app_config").delete().eq("key", `otp:${familyId}`);

      return new Response(JSON.stringify({ verified: true, kids }), { headers: cors });
    }

    // ── Method 4: Kid PIN login ──
    if (method === "kid_pin") {
      if (!kidId || !pin) return new Response(JSON.stringify({ error: "Kid ID and PIN required" }), { status: 400, headers: cors });

      const { data: kid } = await supabase
        .from("kids")
        .select("id, name, avatar, age_group, pin_hash, family_id")
        .eq("id", kidId)
        .single();

      if (!kid) return new Response(JSON.stringify({ error: "Kid not found" }), { status: 404, headers: cors });

      // In production: bcrypt compare
      if (kid.pin_hash !== pin) {
        return new Response(JSON.stringify({ error: "Invalid PIN" }), { status: 401, headers: cors });
      }

      // Update last_active
      await supabase.from("kids").update({ last_active: new Date().toISOString() }).eq("id", kid.id);

      return new Response(
        JSON.stringify({ kid: { id: kid.id, name: kid.name, avatar: kid.avatar, ageGroup: kid.age_group } }),
        { headers: cors }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid method. Use: parent, kid_otp, verify_otp, kid_pin" }), { status: 400, headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: cors });
  }
});
