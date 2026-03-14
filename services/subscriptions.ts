import { Platform } from "react-native";
import { stripeService } from "./stripe";
import { supabase } from "./supabase";

// Expo Go stub — RevenueCat native SDK not available
type PurchasesPackage = any;

export type PaymentMethod = "stripe" | "revenuecat";

interface PurchaseParams {
  familyId: string;
  planId: number;
  billingCycle: "monthly" | "annual";
  priceAmount: number;
  email: string;
  promoCode?: string;
}

export const subscriptionService = {
  /* ──────────────────────────────────────────────────────────────────────
   * RevenueCat — native iOS/Android IAP
   * ──────────────────────────────────────────────────────────────────── */

  /** Initialize RevenueCat (stub for Expo Go) */
  async initRevenueCat(_userId: string) {
    console.warn("RevenueCat not available in Expo Go");
  },

  /** Get available RevenueCat packages (stub for Expo Go) */
  async getOfferings(): Promise<PurchasesPackage[]> {
    return [];
  },

  /** Purchase a RevenueCat package (stub for Expo Go) */
  async purchaseRevenueCat(_pkg: PurchasesPackage) {
    return { success: false, cancelled: false };
  },

  /* ──────────────────────────────────────────────────────────────────────
   * Stripe — Payment Sheet
   * ──────────────────────────────────────────────────────────────────── */

  /** Purchase via Stripe Payment Sheet */
  async purchaseStripe(params: PurchaseParams) {
    return stripeService.purchasePlan({
      familyId: params.familyId,
      planId: params.planId,
      billingCycle: params.billingCycle,
      priceAmount: params.priceAmount,
      email: params.email,
      promoCode: params.promoCode,
    });
  },

  /* ──────────────────────────────────────────────────────────────────────
   * Unified purchase flow — tries Stripe first, falls back to RevenueCat
   * ──────────────────────────────────────────────────────────────────── */

  async purchase(
    params: PurchaseParams,
    method: PaymentMethod = "stripe",
  ): Promise<{
    success: boolean;
    error?: string;
    cancelled?: boolean;
    subscriptionId?: string;
  }> {
    if (method === "stripe") {
      return this.purchaseStripe(params);
    }

    // RevenueCat flow
    try {
      const offerings = await this.getOfferings();
      if (!offerings.length) {
        return { success: false, error: "No packages available" };
      }

      // Find matching package by billing cycle
      const pkg = offerings.find((p) => {
        const id = p.identifier?.toLowerCase() || "";
        return params.billingCycle === "annual"
          ? id.includes("annual") || id.includes("yearly")
          : id.includes("monthly") || id.includes("month");
      }) || offerings[0];

      const result = await this.purchaseRevenueCat(pkg);
      if (result.cancelled) return { success: false, cancelled: true };

      if (result.success) {
        // Update family in DB
        await supabase
          .from("families")
          .update({
            billing_status: "active",
            plan_id: params.planId,
            billing_cycle: params.billingCycle,
          })
          .eq("id", params.familyId);
      }

      return {
        success: result.success,
        error: result.success ? undefined : "Purchase failed",
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Purchase failed" };
    }
  },

  /* ──────────────────────────────────────────────────────────────────────
   * Subscription status
   * ──────────────────────────────────────────────────────────────────── */

  /** Check if user has active subscription (stub for Expo Go) */
  async checkSubscriptionRC(): Promise<boolean> {
    return false;
  },

  /** Check subscription status from DB */
  async checkSubscriptionDB(
    familyId: string,
  ): Promise<{
    isActive: boolean;
    status: string;
    planId: number | null;
    billingCycle: string;
    currentPeriodEnd: string | null;
    trialEnd: string | null;
  }> {
    const { data: family } = await supabase
      .from("families")
      .select(
        "billing_status, plan_id, billing_cycle, current_period_end, trial_end",
      )
      .eq("id", familyId)
      .single();

    if (!family) {
      return {
        isActive: false,
        status: "none",
        planId: null,
        billingCycle: "monthly",
        currentPeriodEnd: null,
        trialEnd: null,
      };
    }

    return {
      isActive:
        family.billing_status === "active" ||
        family.billing_status === "trial",
      status: family.billing_status,
      planId: family.plan_id,
      billingCycle: family.billing_cycle,
      currentPeriodEnd: family.current_period_end,
      trialEnd: family.trial_end,
    };
  },

  /** Restore purchases (stub for Expo Go) */
  async restore(): Promise<boolean> {
    return false;
  },

  /** Cancel subscription via Stripe */
  async cancelSubscription(familyId: string): Promise<boolean> {
    return stripeService.cancelSubscription(familyId);
  },

  /** Change plan via Stripe */
  async changePlan(
    familyId: string,
    newPlanId: number,
    newBillingCycle: "monthly" | "annual",
  ): Promise<boolean> {
    return stripeService.changePlan(familyId, newPlanId, newBillingCycle);
  },
};
