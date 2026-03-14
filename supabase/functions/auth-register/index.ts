import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { email, password, name, country } = await req.json();
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password required" }),
        { status: 400, headers: cors },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Create auth user
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (authError) throw authError;

    // 2. Generate referral code for this family
    const familyReferralCode =
      "ATHK" + Math.random().toString(36).substring(2, 6).toUpperCase();

    // 3. Create family record
    const { data: family, error: famError } = await supabase
      .from("families")
      .insert({
        auth_user_id: authData.user.id,
        email,
        parent_name: name || null,
        country: country || null,
        referral_code: familyReferralCode,
        billing_status: "trial",
      })
      .select()
      .single();
    if (famError) throw famError;

    // 4. Log registration
    await supabase.from("audit_log").insert({
      admin_user_id: null,
      action: "parent_registered",
      target_type: "family",
      target_id: family.id,
      details: { email, country, hasReferral: !!referralCode },
    });

    return new Response(
      JSON.stringify({
        user: authData.user,
        family,
        referralCode: familyReferralCode,
      }),
      { headers: cors },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: cors,
    });
  }
});
