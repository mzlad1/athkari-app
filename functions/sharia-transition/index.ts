import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * POST /functions/v1/sharia-transition
 * Validates and executes sharia status transitions for categories.
 * Enforces the 5-stage pipeline: draft → review → sheikh_review → approved → published
 *
 * Body: { category_id, new_status, admin_id, admin_name, reviewer_id? }
 */

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft:          ["review"],
  review:         ["draft", "sheikh_review"],
  sheikh_review:  ["review", "approved"],
  approved:       ["sheikh_review", "published"],
  published:      ["approved"],  // can unpublish back to approved
};

serve(async (req) => {
  const { category_id, new_status, admin_id, admin_name, reviewer_id } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Get current category
  const { data: category } = await supabase
    .from("categories")
    .select("sharia_status, status_history, reviewer_id, title_en")
    .eq("id", category_id)
    .single();

  if (!category) {
    return new Response(JSON.stringify({ error: "Category not found" }), { status: 404 });
  }

  // 2. Validate transition
  const currentStatus = category.sharia_status;
  const allowedNext = VALID_TRANSITIONS[currentStatus] || [];

  if (!allowedNext.includes(new_status)) {
    return new Response(JSON.stringify({
      error: "Invalid transition",
      current: currentStatus,
      requested: new_status,
      allowed: allowedNext,
    }), { status: 400 });
  }

  // 3. If moving to sheikh_review, reviewer must be assigned
  if (new_status === "sheikh_review" && !reviewer_id && !category.reviewer_id) {
    return new Response(JSON.stringify({
      error: "Reviewer must be assigned before sheikh review",
    }), { status: 400 });
  }

  // 4. Append to status history
  const history = [...(category.status_history || []), {
    status: new_status,
    from: currentStatus,
    by: admin_name || `admin_${admin_id}`,
    at: new Date().toISOString(),
  }];

  // 5. Update category
  const updateData: Record<string, any> = {
    sharia_status: new_status,
    status_history: history,
  };

  if (reviewer_id) {
    updateData.reviewer_id = reviewer_id;
  }

  if (new_status === "approved" || new_status === "published") {
    updateData.reviewed_at = new Date().toISOString();
  }

  await supabase
    .from("categories")
    .update(updateData)
    .eq("id", category_id);

  // 6. Log to audit
  await supabase.from("audit_log").insert({
    admin_id,
    admin_name,
    action: "sharia_transition",
    entity_type: "category",
    entity_id: String(category_id),
    old_value: { status: currentStatus },
    new_value: { status: new_status, reviewer: reviewer_id },
  });

  return new Response(JSON.stringify({
    success: true,
    category: category.title_en,
    transition: `${currentStatus} → ${new_status}`,
    history_length: history.length,
  }));
});
