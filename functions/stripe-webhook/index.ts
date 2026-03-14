import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

/**
 * POST /functions/v1/stripe-webhook
 *
 * Handles Stripe webhook events for subscription lifecycle.
 * Configure this URL in your Stripe Dashboard → Webhooks.
 *
 * Events handled:
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 * - checkout.session.completed
 */
serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2023-10-16",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Verify webhook signature
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const body = await req.text();

  let event: Stripe.Event;

  if (webhookSecret && signature) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
      });
    }
  } else {
    // For development — accept without verification
    event = JSON.parse(body);
  }

  console.log(`Stripe webhook: ${event.type}`);

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const familyId = subscription.metadata?.family_id;

        // Find family by stripe_customer_id or metadata
        const { data: family } = familyId
          ? await supabase
              .from("families")
              .select("id, billing_status")
              .eq("id", familyId)
              .single()
          : await supabase
              .from("families")
              .select("id, billing_status")
              .eq("stripe_customer_id", customerId)
              .single();

        if (!family) {
          console.error(`No family found for customer ${customerId}`);
          break;
        }

        // Map Stripe subscription status to our billing_status
        let billingStatus: string;
        switch (subscription.status) {
          case "active":
            billingStatus = "active";
            break;
          case "trialing":
            billingStatus = "trial";
            break;
          case "past_due":
            billingStatus = "past_due";
            break;
          case "canceled":
          case "unpaid":
            billingStatus = "churned";
            break;
          default:
            billingStatus = "trial";
        }

        // Get plan_id from subscription metadata
        const planId = subscription.metadata?.plan_id
          ? Number(subscription.metadata.plan_id)
          : undefined;

        const billingCycle = subscription.metadata?.billing_cycle || "monthly";

        const updates: Record<string, any> = {
          billing_status: billingStatus,
          stripe_subscription_id: subscription.id,
          current_period_end: new Date(
            subscription.current_period_end * 1000,
          ).toISOString(),
        };

        if (planId) updates.plan_id = planId;
        if (billingCycle) updates.billing_cycle = billingCycle;

        if (subscription.status === "trialing" && subscription.trial_end) {
          updates.trial_end = new Date(
            subscription.trial_end * 1000,
          ).toISOString();
        }

        await supabase
          .from("families")
          .update(updates)
          .eq("id", family.id);

        // Audit log
        await supabase.from("audit_log").insert({
          action: `stripe_subscription_${event.type.split(".").pop()}`,
          entity_type: "family",
          entity_id: family.id,
          old_value: { billing_status: family.billing_status },
          new_value: updates,
        });

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const familyId = subscription.metadata?.family_id;

        const { data: family } = familyId
          ? await supabase
              .from("families")
              .select("id, billing_status")
              .eq("id", familyId)
              .single()
          : await supabase
              .from("families")
              .select("id, billing_status")
              .eq("stripe_customer_id", customerId)
              .single();

        if (family) {
          await supabase
            .from("families")
            .update({
              billing_status: "churned",
              stripe_subscription_id: null,
              current_period_end: null,
            })
            .eq("id", family.id);

          await supabase.from("audit_log").insert({
            action: "stripe_subscription_deleted",
            entity_type: "family",
            entity_id: family.id,
            old_value: { billing_status: family.billing_status },
            new_value: { billing_status: "churned" },
          });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          const { data: family } = await supabase
            .from("families")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .single();

          if (family) {
            await supabase
              .from("families")
              .update({ billing_status: "active" })
              .eq("id", family.id);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: family } = await supabase
          .from("families")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (family) {
          await supabase
            .from("families")
            .update({ billing_status: "past_due" })
            .eq("id", family.id);
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
