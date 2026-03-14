import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

/**
 * POST /functions/v1/manage-subscription
 *
 * Handles subscription management actions:
 * - cancel: Cancel subscription at period end
 * - change_plan: Upgrade/downgrade plan
 * - resume: Resume a cancelled subscription
 * - invoices: List recent invoices for the customer
 * - payment_methods: List saved payment methods
 *
 * Body: {
 *   action: "cancel" | "change_plan" | "resume",
 *   family_id: string,
 *   new_plan_id?: number,       // for change_plan
 *   new_billing_cycle?: string,  // for change_plan
 * }
 */
serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { action, family_id, new_plan_id, new_billing_cycle } = body;

    // Get family
    const { data: family } = await supabase
      .from("families")
      .select(
        "id, stripe_subscription_id, stripe_customer_id, plan_id, billing_status",
      )
      .eq("id", family_id)
      .single();

    if (!family) {
      return new Response(JSON.stringify({ error: "Family not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    switch (action) {
      case "cancel": {
        if (!family.stripe_subscription_id) {
          return new Response(
            JSON.stringify({ error: "No active subscription" }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        }

        // Cancel at period end (user keeps access until billing period ends)
        await stripe.subscriptions.update(family.stripe_subscription_id, {
          cancel_at_period_end: true,
        });

        await supabase.from("audit_log").insert({
          action: "subscription_cancel_requested",
          entity_type: "family",
          entity_id: family.id,
          old_value: { billing_status: family.billing_status },
          new_value: { cancel_at_period_end: true },
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: "Subscription will cancel at period end",
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }

      case "change_plan": {
        if (!family.stripe_subscription_id) {
          return new Response(
            JSON.stringify({ error: "No active subscription to change" }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        }

        if (!new_plan_id) {
          return new Response(
            JSON.stringify({ error: "new_plan_id required" }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        }

        // Get new plan pricing
        const { data: newPlan } = await supabase
          .from("plans")
          .select("*")
          .eq("id", new_plan_id)
          .single();

        if (!newPlan) {
          return new Response(JSON.stringify({ error: "Plan not found" }), {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }

        const cycle = new_billing_cycle || "monthly";
        const priceAmount =
          cycle === "annual"
            ? Math.round(newPlan.price_annual * 100)
            : Math.round(newPlan.price_monthly * 100);
        const interval = cycle === "annual" ? "year" : "month";

        // Find or create product for this plan
        const products = await stripe.products.list({
          limit: 10,
          active: true,
        });
        let product = products.data.find(
          (p) => p.metadata?.athkari_plan_id === String(new_plan_id),
        );

        if (!product) {
          product = await stripe.products.create({
            name: newPlan.name_en,
            metadata: { athkari_plan_id: String(new_plan_id) },
          });
        }

        // Find or create price
        const prices = await stripe.prices.list({
          product: product.id,
          active: true,
          limit: 20,
        });
        let price = prices.data.find(
          (p) =>
            p.recurring?.interval === interval &&
            p.unit_amount === priceAmount &&
            p.currency === "usd",
        );

        if (!price) {
          price = await stripe.prices.create({
            product: product.id,
            unit_amount: priceAmount,
            currency: "usd",
            recurring: { interval },
          });
        }

        // Update the subscription
        const subscription = await stripe.subscriptions.retrieve(
          family.stripe_subscription_id,
        );

        await stripe.subscriptions.update(family.stripe_subscription_id, {
          items: [
            {
              id: subscription.items.data[0].id,
              price: price.id,
            },
          ],
          proration_behavior: "create_prorations",
          metadata: {
            family_id,
            plan_id: String(new_plan_id),
            billing_cycle: cycle,
          },
        });

        // Update family in DB
        await supabase
          .from("families")
          .update({
            plan_id: new_plan_id,
            billing_cycle: cycle,
          })
          .eq("id", family.id);

        // Update max_kids based on plan
        await supabase
          .from("families")
          .update({ max_kids: newPlan.max_kids })
          .eq("id", family.id);

        await supabase.from("audit_log").insert({
          action: "subscription_plan_changed",
          entity_type: "family",
          entity_id: family.id,
          old_value: { plan_id: family.plan_id },
          new_value: { plan_id: new_plan_id, billing_cycle: cycle },
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      case "resume": {
        if (!family.stripe_subscription_id) {
          return new Response(
            JSON.stringify({ error: "No subscription to resume" }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        }

        await stripe.subscriptions.update(family.stripe_subscription_id, {
          cancel_at_period_end: false,
        });

        return new Response(
          JSON.stringify({ success: true, message: "Subscription resumed" }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }

      case "invoices": {
        if (!family.stripe_customer_id) {
          return new Response(JSON.stringify({ invoices: [] }), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }

        const invoices = await stripe.invoices.list({
          customer: family.stripe_customer_id,
          limit: 20,
        });

        const items = invoices.data.map((inv) => ({
          id: inv.id,
          number: inv.number,
          amount: (inv.amount_paid || 0) / 100,
          currency: inv.currency,
          status: inv.status,
          created: inv.created,
          period_start: inv.period_start,
          period_end: inv.period_end,
          invoice_pdf: inv.invoice_pdf,
          hosted_invoice_url: inv.hosted_invoice_url,
        }));

        return new Response(JSON.stringify({ invoices: items }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      case "payment_methods": {
        if (!family.stripe_customer_id) {
          return new Response(
            JSON.stringify({
              payment_methods: [],
              default_payment_method: null,
            }),
            {
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        }

        const methods = await stripe.paymentMethods.list({
          customer: family.stripe_customer_id,
          type: "card",
        });

        // Get default payment method from customer
        const customer = await stripe.customers.retrieve(
          family.stripe_customer_id,
        );
        const defaultPm =
          (customer as any).invoice_settings?.default_payment_method || null;

        const items = methods.data.map((pm) => ({
          id: pm.id,
          brand: pm.card?.brand || "unknown",
          last4: pm.card?.last4 || "****",
          exp_month: pm.card?.exp_month,
          exp_year: pm.card?.exp_year,
          is_default: pm.id === defaultPm,
        }));

        return new Response(
          JSON.stringify({
            payment_methods: items,
            default_payment_method: defaultPm,
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }

      case "upcoming_invoice": {
        if (!family.stripe_subscription_id) {
          return new Response(JSON.stringify({ upcoming_invoice: null }), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }

        try {
          const upcoming = await stripe.invoices.retrieveUpcoming({
            customer: family.stripe_customer_id!,
            subscription: family.stripe_subscription_id,
          });

          return new Response(
            JSON.stringify({
              upcoming_invoice: {
                amount: (upcoming.amount_due || 0) / 100,
                currency: upcoming.currency,
                next_payment_date: upcoming.next_payment_attempt,
                period_start: upcoming.period_start,
                period_end: upcoming.period_end,
              },
            }),
            {
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        } catch {
          return new Response(JSON.stringify({ upcoming_invoice: null }), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
    }
  } catch (err: any) {
    console.error("manage-subscription error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
});
