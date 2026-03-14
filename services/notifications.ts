import { supabase } from "./supabase";

export interface DeviceGeoInfo {
  ip_address?: string;
  country?: string;
  city?: string;
  region?: string;
  timezone?: string;
  isp?: string;
}

export const notificationService = {
  /** Register device token — upserts by (family_id, kid_id) to handle new-device scenarios */
  async registerToken(
    familyId: string,
    kidId: string | null,
    token: string,
    platform: string,
    geo?: DeviceGeoInfo,
  ) {
    const geoFields = geo
      ? {
          ip_address: geo.ip_address,
          country: geo.country,
          city: geo.city,
          region: geo.region,
          timezone: geo.timezone,
          isp: geo.isp,
        }
      : {};

    // Check if row already exists for this (family_id, kid_id) combo —
    // intentionally NOT filtering by token so a new device overwrites the old token
    let query = supabase
      .from("device_tokens")
      .select("id, token")
      .eq("family_id", familyId);

    if (kidId) {
      query = query.eq("kid_id", kidId);
    } else {
      query = query.is("kid_id", null);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      // Update token (handles new-device case) + re-activate + geo info
      await supabase
        .from("device_tokens")
        .update({ token, is_active: true, platform, ...geoFields })
        .eq("id", existing.id);
      return existing;
    }

    console.log(
      `[PushToken] INSERT new row | family=${familyId} kid=${kidId ?? "parent"} token=${token.slice(-8)}`,
    );
    // Insert new row
    const { data, error } = await supabase
      .from("device_tokens")
      .insert({
        family_id: familyId,
        kid_id: kidId,
        token,
        platform,
        is_active: true,
        ...geoFields,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Deactivate device token for a specific family */
  async deactivateToken(token: string, familyId?: string) {
    let query = supabase
      .from("device_tokens")
      .update({ is_active: false })
      .eq("token", token);
    if (familyId) query = query.eq("family_id", familyId);
    await query;
  },

  /** Insert an in-app notification only (no push) */
  async insertInAppNotification(params: {
    toKidId: string;
    type: string;
    titleAr: string;
    titleEn: string;
    bodyAr: string;
    bodyEn: string;
    data?: Record<string, any>;
  }) {
    await supabase.from("kid_notifications").insert({
      kid_id: params.toKidId,
      type: params.type,
      title_ar: params.titleAr,
      title_en: params.titleEn,
      body_ar: params.bodyAr,
      body_en: params.bodyEn,
      data: params.data || {},
    });
  },

  /** Send a kid notification via edge function (uses service_role to bypass RLS) */
  async sendKidNotification(params: {
    toKidId: string;
    type: string;
    titleAr: string;
    titleEn: string;
    bodyAr: string;
    bodyEn: string;
    data?: Record<string, any>;
  }) {
    try {
      await supabase.functions.invoke("kid-notify", {
        body: {
          to_kid_id: params.toKidId,
          type: params.type,
          title_ar: params.titleAr,
          title_en: params.titleEn,
          body_ar: params.bodyAr,
          body_en: params.bodyEn,
          data: params.data || {},
        },
      });
    } catch {
      // Non-blocking — notification is best-effort
    }
  },

  /** Get notifications for a kid with pagination and optional filter */
  async getKidNotifications(
    kidId: string,
    limit = 20,
    offset = 0,
    filter?: "all" | "unread" | "read",
  ) {
    let query = supabase
      .from("kid_notifications")
      .select("*")
      .eq("kid_id", kidId);

    if (filter === "unread") query = query.eq("read", false);
    else if (filter === "read") query = query.eq("read", true);

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return data || [];
  },

  /** Get unread notification count */
  async getUnreadCount(kidId: string) {
    const { count, error } = await supabase
      .from("kid_notifications")
      .select("id", { count: "exact", head: true })
      .eq("kid_id", kidId)
      .eq("read", false);
    if (error) return 0;
    return count || 0;
  },

  /** Mark all notifications as read */
  async markAllRead(kidId: string) {
    await supabase
      .from("kid_notifications")
      .update({ read: true })
      .eq("kid_id", kidId)
      .eq("read", false);
  },

  /** Get unread reactions for a kid */
  async getUnreadReactions(kidId: string) {
    const { data, error } = await supabase
      .from("reactions")
      .select("*, from_kid:kids!reactions_from_kid_id_fkey(name, avatar)")
      .eq("to_kid_id", kidId)
      .eq("read", false)
      .order("created_at", { ascending: false });
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
};
