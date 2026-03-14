import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * GET /functions/v1/wird-assign?kid_id=xxx
 * Returns today's wird for a kid.
 * If kid has a manual assignment, use that.
 * Otherwise, auto-assign based on age group.
 * Returns full adhkar data for the wird template.
 */
serve(async (req) => {
  const url = new URL(req.url);
  const kid_id = url.searchParams.get("kid_id");

  if (!kid_id) {
    return new Response(JSON.stringify({ error: "kid_id required" }), { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Get kid profile
  const { data: kid } = await supabase
    .from("kids")
    .select("id, name, age_group, wird_template_id, streak")
    .eq("id", kid_id)
    .single();

  if (!kid) return new Response(JSON.stringify({ error: "Kid not found" }), { status: 404 });

  // 2. Determine which template to use
  let templateId = kid.wird_template_id;

  if (!templateId) {
    // Auto-assign by age group
    const { data: defaultTemplate } = await supabase
      .from("wird_templates")
      .select("id")
      .eq("age_group", kid.age_group)
      .eq("is_default", true)
      .eq("is_active", true)
      .single();

    templateId = defaultTemplate?.id;

    // Fallback: check for seasonal wird
    if (!templateId) {
      const today = new Date().toISOString().split("T")[0];
      const { data: seasonal } = await supabase
        .from("wird_templates")
        .select("id")
        .eq("is_active", true)
        .lte("seasonal_from", today)
        .gte("seasonal_to", today)
        .single();

      templateId = seasonal?.id;
    }
  }

  if (!templateId) {
    return new Response(JSON.stringify({ error: "No wird template found for age group" }), { status: 404 });
  }

  // 3. Get template with adhkar details
  const { data: template } = await supabase
    .from("wird_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  const adhkarIds = template?.adhkar_ids || [];

  const { data: adhkarList } = await supabase
    .from("adhkar")
    .select("id, text_ar, meaning_ar, meaning_en, repetition_count, points, audio_url, categories!inner(title_ar, icon)")
    .in("id", adhkarIds)
    .eq("sharia_status", "approved");

  // 4. Check today's progress
  const today = new Date().toISOString().split("T")[0];
  const { data: todayLog } = await supabase
    .from("wird_logs")
    .select("completed_items, is_complete")
    .eq("kid_id", kid_id)
    .eq("log_date", today)
    .single();

  return new Response(JSON.stringify({
    template: {
      id: template.id,
      name_ar: template.name_ar,
      name_en: template.name_en,
      reward_stars: template.reward_stars,
    },
    adhkar: adhkarList || [],
    progress: {
      completed_items: todayLog?.completed_items || [],
      is_complete: todayLog?.is_complete || false,
    },
    kid: {
      name: kid.name,
      streak: kid.streak,
    },
  }));
});
