import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * POST /functions/v1/subscription-webhook
 *
 * Handles RevenueCat webhook events.
 * Updates family billing status based on subscription lifecycle.
 *
 * RevenueCat webhook types:
 * - INITIAL_PURCHASE, RENEWAL, CANCELLATION, UNCANCELLATION
 * - BILLING_ISSUE, SUBSCRIBER_ALIAS, PRODUCT_CHANGE
 * - EXPIRATION, TRANSFER
 *
 * Note: Stripe webhooks are handled separately by /functions/v1/stripe-webhook
 */
serve(async (req) => {
  const body = await req.json();
  const event = body.event;

  if (!event) {
    return new Response(JSON.stringify({ error: "No event data" }), { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const rcSubscriberId = event.app_user_id;
  const eventType = event.type;

  // Find family by RevenueCat subscriber ID or by auth_user_id
  let family: any = null;
  const { data: byRC } = await supabase
    .from("families")
    .select("id, billing_status, plan_id")
    .eq("rc_subscriber_id", rcSubscriberId)
    .single();

  if (byRC) {
    family = byRC;
  } else {
    // Fallback: try matching by auth_user_id (RC uses app_user_id = supabase auth ID)
    const { data: byAuth } = await supabase
      .from("families")
      .select("id, billing_status, plan_id")
      .eq("auth_user_id", rcSubscriberId)
      .single();
    if (byAuth) {
      family = byAuth;
      // Save the RC subscriber ID for future lookups
      await supabase
        .from("families")
        .update({ rc_subscriber_id: rcSubscriberId })
        .eq("id", byAuth.id);
    }
  }

  if (!family) {
    console.error(`Family not found for RC subscriber: ${rcSubscriberId}`);
    return new Response(JSON.stringify({ error: "Family not found" }), { status: 404 });
  }

  let updates: Record<string, any> = {};

  switch (eventType) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
      updates = { billing_status: "active" };

      // Map RevenueCat product to plan
      const productId = event.product_id;
      if (productId?.includes("1child")) updates.plan_id = 1;
      else if (productId?.includes("3kids")) updates.plan_id = 2;
      else if (productId?.includes("5kids")) updates.plan_id = 3;

      if (event.period_type === "ANNUAL") updates.billing_cycle = "annual";
      else updates.billing_cycle = "monthly";

      // Store expiration for period tracking
      if (event.expiration_at_ms) {
        updates.current_period_end = new Date(event.expiration_at_ms).toISOString();
      }
      break;

    case "CANCELLATION":
      // Don't immediately downgrade — they paid until period end
      updates = { billing_status: "active" };
      break;

    case "BILLING_ISSUE":
      updates = { billing_status: "past_due" };
      break;

    case "EXPIRATION":
      updates = { billing_status: "churned" };
      break;

    case "PRODUCT_CHANGE":
      // Product changed — update plan mapping
      const newProductId = event.new_product_id || event.product_id;
      if (newProductId?.includes("1child")) updates.plan_id = 1;
      else if (newProductId?.includes("3kids")) updates.plan_id = 2;
      else if (newProductId?.includes("5kids")) updates.plan_id = 3;
      break;

    default:
      console.log(`Unhandled RC event: ${eventType}`);
  }

  if (Object.keys(updates).length > 0) {
    await supabase
      .from("families")
      .update(updates)
      .eq("id", family.id);

    // Audit log
    await supabase.from("audit_log").insert({
      action: "subscription_" + eventType.toLowerCase(),
      entity_type: "family",
      entity_id: family.id,
      old_value: { billing_status: family.billing_status },
      new_value: updates,
    });
  }

  return new Response(
    JSON.stringify({ success: true, event: eventType, family_id: family.id }),
  );
});
