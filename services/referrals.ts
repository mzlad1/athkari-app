import { supabase } from "./supabase";

export const referralService = {
  /** Verify a kid friend_code — returns the matching kid row or null */
  async verifyKidCode(code: string) {
    const { data, error } = await supabase
      .from("kids")
      .select("id, name, avatar, friend_code")
      .eq("friend_code", code.toUpperCase())
      .single();
    if (error || !data) return null;
    return data;
  },

  /**
   * Apply kid-to-kid referral via Edge Function (uses service role to bypass RLS).
   * Awards REFERRAL_STARS to the referrer kid and records the link on the new kid.
   * Throws on failure so the caller can surface the error.
   */
  async applyKidReferral(referrerKidId: string, newKidId: string) {
    if (!referrerKidId || !newKidId) {
      throw new Error("Missing kid IDs for referral");
    }
    const { data, error } = await supabase.functions.invoke("referral-apply", {
      body: { referrer_kid_id: referrerKidId, new_kid_id: newKidId },
    });
    if (error) {
      // Try to extract a readable message from the edge function response body
      let msg = error.message;
      try {
        const ctx = (error as any).context;
        const body = ctx ? await ctx.json() : null;
        if (body?.error) msg = body.error;
      } catch {
        /* ignore parse errors */
      }
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  },

  /** Verify a referral code (legacy family-based, kept for compatibility) */
  async verifyCode(code: string) {
    const { data, error } = await supabase
      .from("families")
      .select("id, referral_code")
      .eq("referral_code", code.toUpperCase())
      .single();
    if (error || !data) return null;
    return data;
  },

  /** Get family's referral stats */
  async getReferralStats(familyId: string) {
    const { data: family } = await supabase
      .from("families")
      .select("referral_code")
      .eq("id", familyId)
      .single();

    const { data: referrals } = await supabase
      .from("referrals")
      .select("id, status, converted_at")
      .eq("referrer_id", familyId);

    return {
      code: family?.referral_code || "",
      totalReferred: referrals?.length || 0,
      converted: referrals?.filter((r) => r.status === "converted").length || 0,
    };
  },
};
