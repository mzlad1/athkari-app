import { Alert, Platform } from "react-native";
import {
  initPaymentSheet,
  presentPaymentSheet,
  confirmPaymentSheetPayment,
} from "@stripe/stripe-react-native";
import { supabase } from "./supabase";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

interface CreateCheckoutParams {
  familyId: string;
  planId: number;
  billingCycle: "monthly" | "annual";
  priceAmount: number; // in dollars
  promoCode?: string;
  email: string;
}

interface CheckoutResult {
  paymentIntent: string;
  ephemeralKey: string;
  customer: string;
  subscriptionId: string;
}

export const stripeService = {
  /**
   * Call Supabase Edge Function to create a Stripe Checkout session
   * Returns client_secret + ephemeral key for Payment Sheet
   */
  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    // Get session token for auth
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/create-payment-intent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          family_id: params.familyId,
          plan_id: params.planId,
          billing_cycle: params.billingCycle,
          price_amount: params.priceAmount,
          promo_code: params.promoCode,
          email: params.email,
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Checkout failed: ${errText}`);
    }

    return res.json();
  },

  /**
   * Initialize Stripe Payment Sheet with server-side data
   */
  async initializePaymentSheet(
    checkout: CheckoutResult,
    merchantName: string = "Athkari",
  ): Promise<{ error: any }> {
    const { error } = await initPaymentSheet({
      merchantDisplayName: merchantName,
      paymentIntentClientSecret: checkout.paymentIntent,
      customerEphemeralKeySecret: checkout.ephemeralKey,
      customerId: checkout.customer,
      allowsDelayedPaymentMethods: false,
      defaultBillingDetails: { name: merchantName },
      style: "automatic",
      googlePay: {
        merchantCountryCode: "US",
        testEnv: true,
      },
      applePay: {
        merchantCountryCode: "US",
      },
    });

    return { error };
  },

  /**
   * Present Stripe Payment Sheet to collect payment
   */
  async presentPaymentSheet(): Promise<{
    success: boolean;
    error?: any;
    cancelled?: boolean;
  }> {
    const { error } = await presentPaymentSheet();

    if (error) {
      if (error.code === "Canceled") {
        return { success: false, cancelled: true };
      }
      return { success: false, error };
    }

    return { success: true };
  },

  /**
   * Full purchase flow: create checkout -> init payment sheet -> present
   */
  async purchasePlan(
    params: CreateCheckoutParams,
  ): Promise<{
    success: boolean;
    subscriptionId?: string;
    error?: string;
    cancelled?: boolean;
  }> {
    try {
      // 1. Create checkout on server
      const checkout = await this.createCheckout(params);

      // 2. Initialize Payment Sheet
      const { error: initError } = await this.initializePaymentSheet(checkout);
      if (initError) {
        return { success: false, error: initError.message };
      }

      // 3. Present Payment Sheet
      const result = await this.presentPaymentSheet();
      if (result.cancelled) {
        return { success: false, cancelled: true };
      }
      if (!result.success) {
        return {
          success: false,
          error: result.error?.message || "Payment failed",
        };
      }

      // 4. Payment succeeded — server webhook will update family billing
      return { success: true, subscriptionId: checkout.subscriptionId };
    } catch (err: any) {
      return { success: false, error: err.message || "Payment failed" };
    }
  },

  /**
   * Cancel subscription via Edge Function
   */
  async cancelSubscription(familyId: string): Promise<boolean> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/manage-subscription`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "cancel",
          family_id: familyId,
        }),
      },
    );

    return res.ok;
  },

  /**
   * Change plan via Edge Function (upgrade/downgrade)
   */
  async changePlan(
    familyId: string,
    newPlanId: number,
    newBillingCycle: "monthly" | "annual",
  ): Promise<boolean> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/manage-subscription`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "change_plan",
          family_id: familyId,
          new_plan_id: newPlanId,
          new_billing_cycle: newBillingCycle,
        }),
      },
    );

    return res.ok;
  },
};
