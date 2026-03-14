import { supabase } from "./supabase";
import type { Plan } from "@/types/database";

export const plansService = {
  /** Get all active subscription plans */
  async getPlans(): Promise<Plan[]> {
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("is_active", true)
      .order("display_order");
    if (error) throw error;
    return data || [];
  },

  /** Get active promo codes */
  async validatePromoCode(code: string) {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", code.toUpperCase())
      .eq("is_active", true)
      .lte("valid_from", today)
      .gte("valid_to", today)
      .single();
    if (error) return null;
    if (data && data.current_uses >= data.max_uses) return null;
    return data;
  },
};
