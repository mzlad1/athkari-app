import { supabase } from "./supabase";
import { notificationService } from "./notifications";

export const activityService = {
  /** Log dhikr completion — calls Edge Function for business logic */
  async logDhikrComplete(
    kidId: string,
    adhkarId: number,
    categoryId: number,
    repetitions: number,
  ) {
    const { data, error } = await supabase.functions.invoke("activity-log", {
      body: {
        kid_id: kidId,
        adhkar_id: adhkarId,
        category_id: categoryId,
        repetitions_done: repetitions,
      },
    });

    if (error) throw error;

    return data; // { success, points_earned, total_stars, streak }
  },

  /** Get today's wird for a kid */
  async getTodayWird(kidId: string) {
    const { data, error } = await supabase.functions.invoke("wird-assign", {
      body: {},
      method: "GET",
      // Pass kid_id as query param
    });

    // Alternative: direct query
    const today = new Date().toISOString().split("T")[0];

    const { data: log } = await supabase
      .from("wird_logs")
      .select("*")
      .eq("kid_id", kidId)
      .eq("log_date", today)
      .single();

    return log;
  },

  /** Mark wird as complete and award bonus stars */
  async completeWird(kidId: string, rewardStars?: number) {
    const bonus = rewardStars || 50;
    const today = new Date().toISOString().split("T")[0];

    const { error } = await supabase
      .from("wird_logs")
      .update({
        is_complete: true,
        completed_at: new Date().toISOString(),
      })
      .eq("kid_id", kidId)
      .eq("log_date", today);

    if (error) throw error;

    // Award completion bonus stars
    const { data: kid } = await supabase
      .from("kids")
      .select("stars")
      .eq("id", kidId)
      .single();

    await supabase
      .from("kids")
      .update({ stars: (kid?.stars || 0) + bonus })
      .eq("id", kidId);

    // In-app notification (no push) — shows in bell/notifications page
    notificationService
      .insertInAppNotification({
        toKidId: kidId,
        type: "wird_complete",
        titleAr: "📖 أكملت وردك اليومي!",
        titleEn: "📖 Daily Wird Complete!",
        bodyAr: `ممتاز! حصلت على ${bonus} ⭐ مكافأة إتمام الورد.`,
        bodyEn: `Excellent! You earned ${bonus} ⭐ as a wird completion bonus.`,
      })
      .catch(() => {});

    return { stars_awarded: bonus };
  },

  /** Mark a single wird item (adhkar) as completed in today's log */
  async completeWirdItem(kidId: string, adhkarId: number) {
    const today = new Date().toISOString().split("T")[0];

    // Get existing log or create one
    let { data: log } = await supabase
      .from("wird_logs")
      .select("*")
      .eq("kid_id", kidId)
      .eq("log_date", today)
      .maybeSingle();

    if (!log) {
      const { data: kid } = await supabase
        .from("kids")
        .select("wird_template_id")
        .eq("id", kidId)
        .single();

      const { data: newLog, error: createErr } = await supabase
        .from("wird_logs")
        .insert({
          kid_id: kidId,
          template_id: kid?.wird_template_id,
          log_date: today,
          completed_items: [],
        })
        .select()
        .single();

      if (createErr) throw createErr;
      log = newLog;
    }

    // Add this adhkar to completed items
    const completedItems = log.completed_items || [];
    if (!completedItems.some((i: any) => i.adhkar_id === adhkarId)) {
      completedItems.push({
        adhkar_id: adhkarId,
        completed_at: new Date().toISOString(),
      });
    }

    const { error } = await supabase
      .from("wird_logs")
      .update({ completed_items: completedItems })
      .eq("id", log.id);

    if (error) throw error;

    // Fire-and-forget: log activity for points in background
    supabase.functions
      .invoke("activity-log", {
        body: {
          kid_id: kidId,
          adhkar_id: adhkarId,
          category_id: 0,
          repetitions_done: 1,
          source: "wird",
        },
      })
      .catch(() => {});

    return { success: true };
  },

  /**
   * Mark a seasonal wird item as completed — writes to seasonal_completed_items
   * so it is completely isolated from regular wird completed_items.
   * itemId can be a numeric adhkar ID or a string ID for custom text items.
   */
  async completeSeasonalWirdItem(kidId: string, itemId: number | string) {
    const today = new Date().toISOString().split("T")[0];
    const isCustom = typeof itemId === "string";

    // Get or create today's log
    let { data: log } = await supabase
      .from("wird_logs")
      .select("*")
      .eq("kid_id", kidId)
      .eq("log_date", today)
      .maybeSingle();

    if (!log) {
      const { data: kid } = await supabase
        .from("kids")
        .select("wird_template_id")
        .eq("id", kidId)
        .single();

      const { data: newLog, error: createErr } = await supabase
        .from("wird_logs")
        .insert({
          kid_id: kidId,
          template_id: kid?.wird_template_id,
          log_date: today,
          completed_items: [],
          seasonal_completed_items: [],
        })
        .select()
        .single();

      if (createErr) throw createErr;
      log = newLog;
    }

    // Add to seasonal_completed_items only — never touches completed_items
    const seasonalItems: any[] = log.seasonal_completed_items || [];
    const alreadyDone = isCustom
      ? seasonalItems.some((i: any) => i.item_id === itemId)
      : seasonalItems.some((i: any) => i.adhkar_id === itemId);

    if (!alreadyDone) {
      seasonalItems.push(
        isCustom
          ? { item_id: itemId, completed_at: new Date().toISOString() }
          : { adhkar_id: itemId, completed_at: new Date().toISOString() },
      );
    }

    const { error } = await supabase
      .from("wird_logs")
      .update({ seasonal_completed_items: seasonalItems })
      .eq("id", log.id);

    if (error) throw error;

    // Award activity points for real adhkar only (custom items have no DB adhkar_id)
    if (!isCustom) {
      supabase.functions
        .invoke("activity-log", {
          body: {
            kid_id: kidId,
            adhkar_id: itemId,
            category_id: 0,
            repetitions_done: 1,
            source: "seasonal_wird",
          },
        })
        .catch(() => {});
    }

    return { success: true };
  },

  /** Award stars when a kid completes the seasonal wird (all items done) */
  async completeSeasonalWird(kidId: string, rewardStars?: number) {
    const bonus = rewardStars || 50;
    const { data: kid } = await supabase
      .from("kids")
      .select("stars")
      .eq("id", kidId)
      .single();

    await supabase
      .from("kids")
      .update({ stars: (kid?.stars || 0) + bonus })
      .eq("id", kidId);

    notificationService
      .insertInAppNotification({
        toKidId: kidId,
        type: "wird_complete",
        titleAr: "🌙 أكملت الوِرد الموسمي!",
        titleEn: "🌙 Seasonal Wird Complete!",
        bodyAr: `رائع! حصلت على ${bonus} ⭐ مكافأة الوِرد الموسمي.`,
        bodyEn: `Amazing! You earned ${bonus} ⭐ as a seasonal wird completion bonus.`,
      })
      .catch(() => {});

    return { stars_awarded: bonus };
  },
};
