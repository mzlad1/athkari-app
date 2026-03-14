import { supabase } from "./supabase";

export const streakService = {
  /** Check and update streak for a kid — calls Edge Function */
  async checkStreak(kidId: string) {
    console.log("[streak-check] invoking with kid_id:", kidId);
    const { data, error } = await supabase.functions.invoke("streak-check", {
      body: { kid_id: kidId },
    });
    if (error) {
      console.error("[streak-check] error:", JSON.stringify(error));
      throw error;
    }
    console.log("[streak-check] success:", JSON.stringify(data));
    return data; // { streak, streak_updated_at, stars_awarded }
  },

  /** Get kid's current streak info */
  async getStreak(kidId: string) {
    const { data, error } = await supabase
      .from("kids")
      .select("streak, streak_updated_at, stars")
      .eq("id", kidId)
      .single();
    if (error) throw error;
    return data;
  },
};
