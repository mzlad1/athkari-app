import { supabase } from "./supabase";
import { notificationService } from "./notifications";

export const challengesService = {
  /** Get active and upcoming challenges */
  async getChallenges() {
    const { data, error } = await supabase
      .from("challenges")
      .select(
        "*, challenge_participants(kid_id, contribution, kids:kid_id(id, name, avatar))",
      )
      .in("status", ["active", "scheduled", "completed"])
      .order("start_date");
    if (error) throw error;
    return data || [];
  },

  /** Get available templates for kids to pick when challenging friends */
  async getTemplates() {
    const { data, error } = await supabase
      .from("challenge_templates")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Get a single challenge with participants */
  async getChallenge(challengeId: number) {
    const { data, error } = await supabase
      .from("challenges")
      .select(
        "*, challenge_participants(kid_id, contribution, kids:kid_id(id, name, avatar))",
      )
      .eq("id", challengeId)
      .single();
    if (error) throw error;
    return data;
  },

  /** Join a community challenge */
  async joinChallenge(challengeId: number, kidId: string) {
    const { data: existing } = await supabase
      .from("challenge_participants")
      .select("kid_id")
      .eq("challenge_id", challengeId)
      .eq("kid_id", kidId)
      .maybeSingle();
    if (existing) return existing;

    const { data, error } = await supabase
      .from("challenge_participants")
      .insert({ challenge_id: challengeId, kid_id: kidId })
      .select()
      .single();
    if (error) throw error;

    await supabase.rpc("increment_challenge_participants", {
      challenge_id: challengeId,
    });
    return data;
  },

  /** Create a 1v1 challenge from a template */
  async create1v1FromTemplate(
    templateId: number,
    fromKidId: string,
    toKidId: string,
  ) {
    const { data: tmpl } = await supabase
      .from("challenge_templates")
      .select("*")
      .eq("id", templateId)
      .single();
    if (!tmpl) throw new Error("Template not found");

    const start = new Date();
    const end = new Date(start.getTime() + tmpl.duration_days * 86400000);

    const { data, error } = await supabase
      .from("challenges")
      .insert({
        template_id: tmpl.id,
        name_en: tmpl.name_en,
        name_ar: tmpl.name_ar,
        type: "1v1",
        dhikr_text_ar: tmpl.dhikr_text_ar,
        dhikr_text_en: tmpl.dhikr_text_en,
        goal: tmpl.goal,
        duration_days: tmpl.duration_days,
        reward_stars: tmpl.reward_stars,
        celebration_type: tmpl.celebration_type || "confetti",
        start_date: start.toISOString().split("T")[0],
        end_date: end.toISOString().split("T")[0],
        status: "scheduled",
        participant_count: 2,
      })
      .select()
      .single();

    if (error) throw error;

    await supabase.from("challenge_participants").insert([
      { challenge_id: data.id, kid_id: fromKidId, contribution: 0 },
      { challenge_id: data.id, kid_id: toKidId, contribution: -1 },
    ]);

    const { data: challenger } = await supabase
      .from("kids")
      .select("name, avatar")
      .eq("id", fromKidId)
      .single();

    notificationService.sendKidNotification({
      toKidId,
      type: "challenge_invite",
      titleAr: "\u2694\uFE0F \u062A\u062D\u062F\u064A \u062C\u062F\u064A\u062F!",
      titleEn: "\u2694\uFE0F New Challenge!",
      bodyAr: `${challenger?.name || "\u0635\u062F\u064A\u0642\u0643"} \u064A\u062A\u062D\u062F\u0627\u0643 \u0641\u064A ${tmpl.name_ar}! \u0647\u0644 \u062A\u0642\u0628\u0644\u061F`,
      bodyEn: `${challenger?.name || "Your friend"} challenges you to ${tmpl.name_en}! Accept?`,
      data: { challenge_id: data.id, from_kid_id: fromKidId },
    });

    return data;
  },

  /** Get pending 1v1 invites */
  async getPendingInvites(kidId: string) {
    const { data: participations } = await supabase
      .from("challenge_participants")
      .select("challenge_id")
      .eq("kid_id", kidId)
      .eq("contribution", -1);

    if (!participations || participations.length === 0) return [];

    const challengeIds = participations.map((p) => p.challenge_id);
    const { data, error } = await supabase
      .from("challenges")
      .select(
        "*, challenge_participants(kid_id, contribution, kids:kid_id(id, name, avatar))",
      )
      .in("id", challengeIds)
      .eq("status", "scheduled");

    if (error) throw error;
    return data || [];
  },

  /** Accept a 1v1 invite */
  async acceptInvite(challengeId: number, kidId: string) {
    await supabase
      .from("challenge_participants")
      .update({ contribution: 0 })
      .eq("challenge_id", challengeId)
      .eq("kid_id", kidId);

    const challenge = await supabase
      .from("challenges")
      .select("duration_days")
      .eq("id", challengeId)
      .single();

    const duration = challenge.data?.duration_days || 3;
    const start = new Date();
    const end = new Date(start.getTime() + duration * 86400000);

    await supabase
      .from("challenges")
      .update({
        status: "active",
        start_date: start.toISOString().split("T")[0],
        end_date: end.toISOString().split("T")[0],
      })
      .eq("id", challengeId);

    const { data: participants } = await supabase
      .from("challenge_participants")
      .select("kid_id")
      .eq("challenge_id", challengeId)
      .neq("kid_id", kidId);

    const { data: acceptor } = await supabase
      .from("kids")
      .select("name")
      .eq("id", kidId)
      .single();

    if (participants?.[0]) {
      notificationService.sendKidNotification({
        toKidId: participants[0].kid_id,
        type: "challenge_accepted",
        titleAr: "\u2705 \u062A\u0645 \u0642\u0628\u0648\u0644 \u0627\u0644\u062A\u062D\u062F\u064A!",
        titleEn: "\u2705 Challenge Accepted!",
        bodyAr: `${acceptor?.name || "\u0635\u062F\u064A\u0642\u0643"} \u0642\u0628\u0644 \u062A\u062D\u062F\u064A\u0643! \u0627\u0628\u062F\u0623 \u0627\u0644\u0622\u0646`,
        bodyEn: `${acceptor?.name || "Your friend"} accepted! Game on!`,
        data: { challenge_id: challengeId },
      });
    }
  },

  /** Reject a 1v1 invite */
  async rejectInvite(challengeId: number, kidId: string) {
    await supabase
      .from("challenge_participants")
      .delete()
      .eq("challenge_id", challengeId);
    await supabase.from("challenges").delete().eq("id", challengeId);
  },

  /**
   * Tap the dhikr button for a specific challenge.
   * This is the ONLY way to increase contribution — per-challenge, not global.
   */
  async tapDhikr(challengeId: number, kidId: string) {
    const { data: part } = await supabase
      .from("challenge_participants")
      .select("contribution")
      .eq("challenge_id", challengeId)
      .eq("kid_id", kidId)
      .single();

    if (!part) throw new Error("Not a participant");

    const newContribution = (part.contribution || 0) + 1;

    await supabase
      .from("challenge_participants")
      .update({ contribution: newContribution })
      .eq("challenge_id", challengeId)
      .eq("kid_id", kidId);

    // For community challenges, also increment global progress
    const { data: challenge } = await supabase
      .from("challenges")
      .select("type, progress, goal, reward_stars, status")
      .eq("id", challengeId)
      .single();

    if (challenge?.type !== "1v1" && challenge?.status === "active") {
      const newProgress = (challenge.progress || 0) + 1;
      await supabase
        .from("challenges")
        .update({ progress: newProgress })
        .eq("id", challengeId);

      if (challenge.goal > 0 && newProgress >= challenge.goal) {
        await this.completeCommunityChallenge(
          challengeId,
          challenge.reward_stars || 50,
        );
      }
    }

    return newContribution;
  },

  /** Get leaderboard */
  async getLeaderboard(kidId: string) {
    const { data: friendships } = await supabase
      .from("friendships")
      .select("friend_id")
      .eq("kid_id", kidId);

    const friendIds = [kidId, ...(friendships?.map((f) => f.friend_id) || [])];
    const today = new Date().toISOString().split("T")[0];

    const [kidsRes, goalsRes] = await Promise.all([
      supabase
        .from("kids")
        .select("id, name, avatar, stars, streak, level")
        .in("id", friendIds),
      supabase
        .from("daily_goals")
        .select("kid_id, completed_count")
        .in("kid_id", friendIds)
        .eq("goal_date", today),
    ]);

    const kidList = kidsRes.data || [];
    const todayMap: Record<string, number> = {};
    for (const g of goalsRes.data || [])
      todayMap[g.kid_id] = g.completed_count || 0;

    const sorted = [...kidList].sort((a, b) => (b.stars || 0) - (a.stars || 0));
    const ranked = sorted.map((k, i, arr) => {
      let rank = i + 1;
      for (let j = 0; j < i; j++) {
        if ((arr[j].stars || 0) === (k.stars || 0)) { rank = j + 1; break; }
      }
      return { ...k, rank, today_count: todayMap[k.id] || 0 };
    });
    return ranked;
  },

  /** Complete a community challenge and reward participants with tiered stars */
  async completeCommunityChallenge(challengeId: number, rewardStars: number) {
    const { data: challenge } = await supabase
      .from("challenges")
      .select("status, reward_stars, reward_stars_2nd, reward_stars_3rd")
      .eq("id", challengeId)
      .single();

    if (challenge?.status !== "active") return;

    const stars1st = challenge.reward_stars || rewardStars || 50;
    const stars2nd =
      challenge.reward_stars_2nd || Math.round(stars1st * 0.7);
    const stars3rd =
      challenge.reward_stars_3rd || Math.round(stars1st * 0.5);
    const starsParticipation = Math.round(stars1st * 0.3);

    await supabase
      .from("challenges")
      .update({ status: "completed" })
      .eq("id", challengeId);

    const { data: parts } = await supabase
      .from("challenge_participants")
      .select("kid_id, contribution")
      .eq("challenge_id", challengeId)
      .gte("contribution", 0)
      .order("contribution", { ascending: false });

    if (parts && parts.length > 0) {
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const rank = i + 1;

        // Determine stars based on rank
        let earnedStars: number;
        if (rank === 1) earnedStars = stars1st;
        else if (rank === 2) earnedStars = stars2nd;
        else if (rank === 3) earnedStars = stars3rd;
        else earnedStars = starsParticipation;

        const { data: kid } = await supabase
          .from("kids")
          .select("stars")
          .eq("id", p.kid_id)
          .single();

        await supabase
          .from("kids")
          .update({ stars: (kid?.stars || 0) + earnedStars })
          .eq("id", p.kid_id);

        await supabase
          .from("challenge_participants")
          .update({ rewarded_at: new Date().toISOString(), rank })
          .eq("challenge_id", challengeId)
          .eq("kid_id", p.kid_id);

        // Rank-specific notification
        const rankEmoji =
          rank === 1
            ? "\uD83E\uDD47"
            : rank === 2
              ? "\uD83E\uDD48"
              : rank === 3
                ? "\uD83E\uDD49"
                : "\uD83C\uDF89";
        const rankLabelAr =
          rank === 1
            ? "المركز الأول"
            : rank === 2
              ? "المركز الثاني"
              : rank === 3
                ? "المركز الثالث"
                : "مشارك";
        const rankLabelEn =
          rank === 1
            ? "1st place"
            : rank === 2
              ? "2nd place"
              : rank === 3
                ? "3rd place"
                : "Participant";

        notificationService.sendKidNotification({
          toKidId: p.kid_id,
          type: "challenge_won",
          titleAr: `${rankEmoji} اكتمل تحدي المجتمع!`,
          titleEn: `${rankEmoji} Community Challenge Complete!`,
          bodyAr: `أحسنت! ${rankLabelAr} — حصلت على ${earnedStars} نجمة ⭐`,
          bodyEn: `Great job! ${rankLabelEn} — You earned ${earnedStars} stars ⭐`,
          data: { challenge_id: challengeId },
        });
      }
    }
  },

  /** Check and complete expired challenges */
  async checkAndCompleteExpired() {
    const today = new Date().toISOString().split("T")[0];

    const { data: expired1v1 } = await supabase
      .from("challenges")
      .select("id, reward_stars, celebration_type")
      .eq("status", "active")
      .eq("type", "1v1")
      .lte("end_date", today);

    if (expired1v1 && expired1v1.length > 0) {
      for (const c of expired1v1) {
        const { data: parts } = await supabase
          .from("challenge_participants")
          .select("kid_id, contribution, kids:kid_id(name)")
          .eq("challenge_id", c.id)
          .order("contribution", { ascending: false });

        await supabase
          .from("challenges")
          .update({ status: "completed" })
          .eq("id", c.id);

        if (parts && parts.length >= 2) {
          const winner = parts[0];
          const loser = parts[1];
          const winnerName = (winner as any).kids?.name || "?";
          const stars = c.reward_stars || 50;

          const { data: kid } = await supabase
            .from("kids")
            .select("stars")
            .eq("id", winner.kid_id)
            .single();
          await supabase
            .from("kids")
            .update({ stars: (kid?.stars || 0) + stars })
            .eq("id", winner.kid_id);

          notificationService.sendKidNotification({
            toKidId: winner.kid_id,
            type: "challenge_won",
            titleAr: "\uD83C\uDFC6 فزت بالتحدي!",
            titleEn: "\uD83C\uDFC6 You Won!",
            bodyAr: `أحسنت! +${stars} ⭐`,
            bodyEn: `Great job! +${stars} ⭐`,
            data: { challenge_id: c.id },
          });

          notificationService.sendKidNotification({
            toKidId: loser.kid_id,
            type: "challenge_won",
            titleAr: "\u2694\uFE0F انتهى التحدي",
            titleEn: "\u2694\uFE0F Challenge Over",
            bodyAr: `الفائز: ${winnerName}. حاول مرة ثانية!`,
            bodyEn: `Winner: ${winnerName}. Try again!`,
            data: { challenge_id: c.id },
          });
        }
      }
    }

    const { data: expiredCommunity } = await supabase
      .from("challenges")
      .select("id, reward_stars, reward_stars_2nd, reward_stars_3rd")
      .eq("status", "active")
      .neq("type", "1v1")
      .lte("end_date", today);

    if (expiredCommunity && expiredCommunity.length > 0) {
      for (const c of expiredCommunity) {
        await this.completeCommunityChallenge(c.id, c.reward_stars || 50);
      }
    }
  },
};
