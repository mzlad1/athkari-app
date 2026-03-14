import Purchases, { PurchasesPackage } from "react-native-purchases";
import { Platform } from "react-native";
import { stripeService } from "./stripe";
import { supabase } from "./supabase";

const RC_API_KEY =
  Platform.OS === "ios"
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY!
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY!;

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

  /** Initialize RevenueCat */
  async initRevenueCat(userId: string) {
    try {
      Purchases.configure({ apiKey: RC_API_KEY, appUserID: userId });
    } catch (e) {
      console.warn("RevenueCat init failed:", e);
    }
  },

  /** Get available RevenueCat packages */
  async getOfferings(): Promise<PurchasesPackage[]> {
    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current?.availablePackages || [];
    } catch (e) {
      console.error("RevenueCat offerings error:", e);
      return [];
    }
  },

  /** Purchase a RevenueCat package (native IAP) */
  async purchaseRevenueCat(pkg: PurchasesPackage) {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return {
        success: true,
        isActive: customerInfo.entitlements.active["premium"] !== undefined,
      };
    } catch (e: any) {
      if (e.userCancelled) return { success: false, cancelled: true };
      throw e;
    }
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

  /** Check if user has active subscription via RevenueCat */
  async checkSubscriptionRC(): Promise<boolean> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo.entitlements.active["premium"] !== undefined;
    } catch {
      return false;
    }
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

  /** Restore purchases (RevenueCat) */
  async restore(): Promise<boolean> {
    try {
      const customerInfo = await Purchases.restorePurchases();
      return customerInfo.entitlements.active["premium"] !== undefined;
    } catch {
      return false;
    }
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
