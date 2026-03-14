import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

/**
 * POST /functions/v1/create-payment-intent
 *
 * Creates a Stripe Customer (if needed), Subscription with trial,
 * and returns the client_secret + ephemeral key for the Payment Sheet.
 *
 * Body: {
 *   family_id: string,
 *   plan_id: number,
 *   billing_cycle: "monthly" | "annual",
 *   price_amount: number,  // in dollars
 *   promo_code?: string,
 *   email: string
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
    const { family_id, plan_id, billing_cycle, price_amount, promo_code, email } = body;

    if (!family_id || !plan_id || !billing_cycle || !price_amount || !email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // 1. Get or create Stripe customer
    const { data: family } = await supabase
      .from("families")
      .select("stripe_customer_id, parent_name")
      .eq("id", family_id)
      .single();

    let customerId = family?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: family?.parent_name || email,
        metadata: { family_id, supabase_family_id: family_id },
      });
      customerId = customer.id;

      // Save customer ID to family
      await supabase
        .from("families")
        .update({ stripe_customer_id: customerId })
        .eq("id", family_id);
    }

    // 2. Get or create the Stripe Price
    //    We look up by product metadata to find existing, or create new
    const priceInCents = Math.round(price_amount * 100);
    const interval = billing_cycle === "annual" ? "year" : "month";

    // Look for existing product for this plan
    const products = await stripe.products.list({
      limit: 10,
      active: true,
    });
    let product = products.data.find(
      (p) => p.metadata?.athkari_plan_id === String(plan_id),
    );

    if (!product) {
      // Get plan name from DB
      const { data: plan } = await supabase
        .from("plans")
        .select("name_en, name_ar, max_kids")
        .eq("id", plan_id)
        .single();

      product = await stripe.products.create({
        name: plan?.name_en || `Athkari Plan ${plan_id}`,
        description: `${plan?.name_en} - Up to ${plan?.max_kids} kids`,
        metadata: { athkari_plan_id: String(plan_id) },
      });
    }

    // Find or create price for this product + interval + amount
    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 20,
    });
    let price = prices.data.find(
      (p) =>
        p.recurring?.interval === interval &&
        p.unit_amount === priceInCents &&
        p.currency === "usd",
    );

    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: priceInCents,
        currency: "usd",
        recurring: { interval },
        metadata: {
          athkari_plan_id: String(plan_id),
          billing_cycle,
        },
      });
    }

    // 3. Check for promo code / coupon
    let discountParams: any = {};
    if (promo_code) {
      const { data: promo } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("code", promo_code.toUpperCase())
        .eq("is_active", true)
        .single();

      if (promo && promo.discount_type === "percent") {
        // Create or find Stripe coupon
        try {
          const coupon = await stripe.coupons.create({
            percent_off: Number(promo.discount_value),
            duration: "once",
            metadata: { athkari_promo_code: promo_code },
          });
          discountParams = { coupon: coupon.id };
        } catch {
          // Coupon creation failed, proceed without discount
        }
      }
    }

    // 4. Create Subscription with trial
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      trial_period_days: 7,
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        family_id,
        plan_id: String(plan_id),
        billing_cycle,
      },
      ...discountParams,
    });

    // 5. Create ephemeral key for Payment Sheet
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: "2023-10-16" },
    );

    // 6. Get the PaymentIntent client secret
    const invoice = subscription.latest_invoice as any;
    const paymentIntent = invoice?.payment_intent as any;

    // If trial (no immediate charge), create a SetupIntent instead
    let clientSecret: string;
    if (!paymentIntent) {
      // Trial subscription — create SetupIntent to collect payment method
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ["card"],
        metadata: {
          family_id,
          subscription_id: subscription.id,
        },
      });
      clientSecret = setupIntent.client_secret!;
    } else {
      clientSecret = paymentIntent.client_secret;
    }

    // 7. Update family with subscription ID
    await supabase
      .from("families")
      .update({
        stripe_subscription_id: subscription.id,
        plan_id,
        billing_cycle,
        billing_status: "trial",
        trial_start: new Date().toISOString(),
        trial_end: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })
      .eq("id", family_id);

    return new Response(
      JSON.stringify({
        paymentIntent: clientSecret,
        ephemeralKey: ephemeralKey.secret,
        customer: customerId,
        subscriptionId: subscription.id,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (err: any) {
    console.error("create-payment-intent error:", err);
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
