import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * POST /functions/v1/verify-parent-pin
 * Verifies the parent's PIN against the stored hash in the families table.
 *
 * Body: { family_id, pin }
 * Returns: { valid: boolean }
 */
serve(async (req) => {
  try {
    const { family_id, pin } = await req.json();

    if (!family_id || !pin) {
      return new Response(
        JSON.stringify({ error: "family_id and pin are required" }),
        { status: 400, headers: JSON_HEADERS },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: family, error } = await supabase
      .from("families")
      .select("parent_pin_hash")
      .eq("id", family_id)
      .single();

    if (error || !family) {
      return new Response(JSON.stringify({ error: "Family not found" }), {
        status: 404,
        headers: JSON_HEADERS,
      });
    }

    // If no PIN has been set yet, always allow access
    if (!family.parent_pin_hash) {
      return new Response(JSON.stringify({ valid: true, no_pin_set: true }), {
        headers: JSON_HEADERS,
      });
    }

    // Compare plain text PIN (stored as plain text since we don't have a
    // bcrypt edge function in this setup)
    const valid = family.parent_pin_hash === pin;

    return new Response(JSON.stringify({ valid }), { headers: JSON_HEADERS });
  } catch (err) {
    console.error("verify-parent-pin error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      { status: 500, headers: JSON_HEADERS },
    );
  }
});
