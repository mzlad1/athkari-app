import { supabase } from "./supabase";
import { notificationService } from "./notifications";

export const friendsService = {
  /** Get kid's friends list */
  async getFriends(kidId: string) {
    const { data: friendships, error } = await supabase
      .from("friendships")
      .select("friend_id")
      .eq("kid_id", kidId);
    if (error) throw error;
    if (!friendships || friendships.length === 0) return [];

    const friendIds = friendships.map((f) => f.friend_id);
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

    const todayMap: Record<string, number> = {};
    for (const g of goalsRes.data || [])
      todayMap[g.kid_id] = g.completed_count || 0;

    return (kidsRes.data || []).map((k) => ({
      ...k,
      today_count: todayMap[k.id] || 0,
    }));
  },

  /** Send friend request (kid initiates) */
  async sendRequest(fromKidId: string, friendCode: string) {
    // ── Enforce max_friends_per_kid limit ──
    try {
      const { data: configRow } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "max_friends_per_kid")
        .single();
      const maxFriends = configRow?.value ?? 20;

      const { count } = await supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .eq("kid_id", fromKidId);

      if (count !== null && count >= maxFriends) {
        throw new Error(
          `Maximum friends limit reached (${maxFriends}). Remove a friend first.`,
        );
      }
    } catch (e: any) {
      if (e?.message?.includes("Maximum friends limit")) throw e;
      // If config fetch fails, allow the request to proceed
    }

    const { data: friend } = await supabase
      .from("kids")
      .select("id")
      .eq("friend_code", friendCode)
      .single();

    if (!friend) throw new Error("Friend code not found");
    if (friend.id === fromKidId) throw new Error("Cannot add yourself");

    // Get sender's name for notification
    const { data: sender } = await supabase
      .from("kids")
      .select("name, avatar")
      .eq("id", fromKidId)
      .single();

    // Check if already friends
    const { data: existing } = await supabase
      .from("friendships")
      .select("id")
      .eq("kid_id", fromKidId)
      .eq("friend_id", friend.id)
      .maybeSingle();
    if (existing) throw new Error("Already friends");

    // Check if request already pending
    const { data: pendingReq } = await supabase
      .from("friend_requests")
      .select("id")
      .eq("from_kid_id", fromKidId)
      .eq("to_kid_id", friend.id)
      .eq("status", "pending")
      .maybeSingle();
    if (pendingReq) throw new Error("Request already sent");

    const { data, error } = await supabase
      .from("friend_requests")
      .insert({ from_kid_id: fromKidId, to_kid_id: friend.id })
      .select()
      .single();

    if (error) throw error;

    // Notify the target kid about the friend request
    notificationService.sendKidNotification({
      toKidId: friend.id,
      type: "friend_request",
      titleAr: "👥 طلب صداقة جديد",
      titleEn: "👥 New Friend Request",
      bodyAr: `${sender?.name || "صديق"} يريد إضافتك كصديق!`,
      bodyEn: `${sender?.name || "Someone"} wants to be your friend!`,
      data: { from_kid_id: fromKidId },
    });

    return data;
  },

  /** Get incoming pending requests for a kid */
  async getIncomingRequests(kidId: string) {
    const { data, error } = await supabase
      .from("friend_requests")
      .select(
        "*, from_kid:kids!friend_requests_from_kid_id_fkey(id, name, avatar)",
      )
      .eq("to_kid_id", kidId)
      .eq("status", "pending");
    if (error) throw error;
    return data || [];
  },

  /** Get outgoing pending requests from a kid */
  async getOutgoingRequests(kidId: string) {
    const { data, error } = await supabase
      .from("friend_requests")
      .select("*, to_kid:kids!friend_requests_to_kid_id_fkey(id, name, avatar)")
      .eq("from_kid_id", kidId)
      .eq("status", "pending");
    if (error) throw error;
    return data || [];
  },

  /** Kid accepts a friend request → auto-create friendship */
  async acceptRequest(requestId: string) {
    const { data: req } = await supabase
      .from("friend_requests")
      .update({
        status: "approved",
        approved_by_parent: true,
        parent_approved_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select()
      .single();

    if (!req) throw new Error("Request not found");

    await supabase.from("friendships").insert([
      { kid_id: req.from_kid_id, friend_id: req.to_kid_id },
      { kid_id: req.to_kid_id, friend_id: req.from_kid_id },
    ]);

    // Notify the requester that their request was accepted
    const { data: acceptor } = await supabase
      .from("kids")
      .select("name, avatar")
      .eq("id", req.to_kid_id)
      .single();

    notificationService.sendKidNotification({
      toKidId: req.from_kid_id,
      type: "friend_accepted",
      titleAr: "🎉 تمت الموافقة!",
      titleEn: "🎉 Request Accepted!",
      bodyAr: `${acceptor?.name || "صديقك"} قبل طلب صداقتك!`,
      bodyEn: `${acceptor?.name || "Your friend"} accepted your request!`,
      data: { friend_kid_id: req.to_kid_id },
    });

    return req;
  },

  /** Parent approves friend request (kept for parent dashboard) */
  async approveRequest(requestId: string) {
    return this.acceptRequest(requestId);
  },

  /** Reject / decline a friend request */
  async rejectRequest(requestId: string) {
    await supabase
      .from("friend_requests")
      .update({ status: "rejected" })
      .eq("id", requestId);
  },

  /** Remove a friend (parent or kid) */
  async removeFriend(kidId: string, friendId: string) {
    await supabase
      .from("friendships")
      .delete()
      .or(
        `and(kid_id.eq.${kidId},friend_id.eq.${friendId}),and(kid_id.eq.${friendId},friend_id.eq.${kidId})`,
      );
  },

  /** Send pre-set reaction or chat message */
  async sendReaction(fromKidId: string, toKidId: string, type: string) {
    const { data, error } = await supabase.from("reactions").insert({
      from_kid_id: fromKidId,
      to_kid_id: toKidId,
      type: type as any,
    });
    if (error) throw error;

    // Get sender name for notification
    const { data: sender } = await supabase
      .from("kids")
      .select("name, avatar")
      .eq("id", fromKidId)
      .single();

    const REACTION_AR: Record<string, string> = {
      well_done: "أحسنت! 👏",
      keep_going: "يلا كمّل! 💪",
      masha_allah: "ما شاء الله! 🌟",
      challenge_me: "تبي تتحدى؟ ⚔️",
    };
    const REACTION_EN: Record<string, string> = {
      well_done: "Well done! 👏",
      keep_going: "Keep going! 💪",
      masha_allah: "Masha'Allah! 🌟",
      challenge_me: "Challenge me? ⚔️",
    };

    notificationService.sendKidNotification({
      toKidId,
      type: "reaction",
      titleAr: `💬 رسالة من ${sender?.name || "صديق"}`,
      titleEn: `💬 Message from ${sender?.name || "a friend"}`,
      bodyAr: REACTION_AR[type] || type,
      bodyEn: REACTION_EN[type] || type,
      data: { from_kid_id: fromKidId, reaction_type: type },
    });

    return data;
  },

  /** Get unread incoming reactions for a kid */
  async getIncomingReactions(kidId: string) {
    const { data, error } = await supabase
      .from("reactions")
      .select("*, from_kid:kids!reactions_from_kid_id_fkey(id, name, avatar)")
      .eq("to_kid_id", kidId)
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  },

  /** Mark reactions as read */
  async markReactionsRead(kidId: string) {
    await supabase
      .from("reactions")
      .update({ read: true })
      .eq("to_kid_id", kidId)
      .eq("read", false);
  },

  /** Get full chat/reaction history between two kids */
  async getChatHistory(kidId: string, friendId: string) {
    const { data, error } = await supabase
      .from("reactions")
      .select("id, from_kid_id, to_kid_id, type, created_at, read")
      .or(
        `and(from_kid_id.eq.${kidId},to_kid_id.eq.${friendId}),and(from_kid_id.eq.${friendId},to_kid_id.eq.${kidId})`,
      )
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw error;
    return data || [];
  },

  /** Get pending friend requests for parent approval (family-wide) */
  async getPendingRequests(familyId: string) {
    const { data: kids } = await supabase
      .from("kids")
      .select("id")
      .eq("family_id", familyId);

    const kidIds = kids?.map((k) => k.id) || [];

    const { data, error } = await supabase
      .from("friend_requests")
      .select("*, from_kid:kids!friend_requests_from_kid_id_fkey(name, avatar)")
      .in("to_kid_id", kidIds)
      .eq("status", "pending");

    if (error) throw error;
    return data;
  },
};
