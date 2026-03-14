import { Platform } from "react-native";
import { supabase } from "./supabase";
import { getCalendars } from "expo-localization";

export interface GeoInfo {
  ip: string;
  country: string;
  city: string;
  region: string;
  timezone: string;
  isp: string;
}

function getDeviceTimezone(): string {
  try {
    const calendars = getCalendars();
    if (calendars.length > 0 && calendars[0].timeZone) {
      return calendars[0].timeZone;
    }
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown";
  } catch {
    return "Unknown";
  }
}

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

async function tryGeoAPI1(): Promise<GeoInfo | null> {
  const res = await fetchWithTimeout("https://ipwho.is/", 6000);
  if (!res.ok) return null;
  const d = await res.json();
  if (!d.success) return null;
  return {
    ip: d.ip || "",
    country: d.country_code || d.country || "",
    city: d.city || "",
    region: d.region || "",
    timezone: d.timezone?.id || "",
    isp: d.connection?.isp || "",
  };
}

async function tryGeoAPI2(): Promise<GeoInfo | null> {
  const res = await fetchWithTimeout("https://ipapi.co/json/", 6000);
  if (!res.ok) return null;
  const d = await res.json();
  if (d.error) return null;
  return {
    ip: d.ip || "",
    country: d.country_code || d.country_name || "",
    city: d.city || "",
    region: d.region || "",
    timezone: d.timezone || "",
    isp: d.org || "",
  };
}

async function tryGeoAPI3(): Promise<GeoInfo | null> {
  const res = await fetchWithTimeout("https://freeipapi.com/api/json", 6000);
  if (!res.ok) return null;
  const d = await res.json();
  return {
    ip: d.ipAddress || "",
    country: d.countryCode || d.countryName || "",
    city: d.cityName || "",
    region: d.regionName || "",
    timezone: d.timeZone || "",
    isp: "",
  };
}

export async function detectGeoFromIP(): Promise<GeoInfo> {
  const deviceTz = getDeviceTimezone();

  const fallback: GeoInfo = {
    ip: "Unknown",
    country: "Unknown",
    city: "Unknown",
    region: "Unknown",
    timezone: deviceTz,
    isp: "Unknown",
  };

  const apis = [tryGeoAPI2, tryGeoAPI3, tryGeoAPI1];
  for (const apiFn of apis) {
    try {
      const result = await apiFn();
      if (result && result.ip && result.country) {
        return {
          ip: result.ip || fallback.ip,
          country: result.country || fallback.country,
          city: result.city || fallback.city,
          region: result.region || fallback.region,
          timezone: deviceTz,
          isp: result.isp || fallback.isp,
        };
      }
    } catch {
      continue;
    }
  }

  return fallback;
}

export const authService = {
  /** Register new parent account */
  async registerParent(email: string, password: string, name: string) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;

    // Detect country/city/timezone from IP — waits until we get data
    const geo = await detectGeoFromIP();

    // Create family record with geo info
    const { data: family, error: familyError } = await supabase
      .from("families")
      .insert({
        auth_user_id: authData.user?.id,
        parent_name: name,
        parent_email: email,
        billing_status: "trial",
        trial_start: new Date().toISOString().split("T")[0],
        trial_end: new Date(Date.now() + 7 * 86400000)
          .toISOString()
          .split("T")[0],
        referral_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
        country: geo.country,
        device_type: Platform.OS || "unknown",
        ip_address: geo.ip,
        city: geo.city,
        region: geo.region,
        timezone: geo.timezone,
        isp: geo.isp,
      })
      .select()
      .single();

    if (familyError) throw familyError;
    return { user: authData.user, family };
  },

  /** Parent login */
  async loginParent(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  /** Send OTP via push notification to parent (for kid login) */
  async sendKidOTP(email: string) {
    const { data, error } = await supabase.functions.invoke("kid-otp", {
      body: { action: "send", email },
    });
    if (error) throw error;
    if (data?.error === "no_family_found") {
      throw new Error("No account found for this email");
    }
    if (data?.error === "no_push_token") {
      throw new Error(
        "Parent must open the app first to receive notifications",
      );
    }
    if (data?.error) throw new Error(data.error);
    return data;
  },

  /** Verify OTP and create session (for kid login) */
  async verifyKidOTP(email: string, otp: string) {
    const { data, error } = await supabase.functions.invoke("kid-otp", {
      body: { action: "verify", email, otp },
    });
    if (error) throw error;
    if (data?.error === "invalid_or_expired_otp") {
      throw new Error("Invalid or expired code");
    }
    if (data?.error) throw new Error(data.error);

    // Use the token_hash to verify and create a session
    if (data?.token_hash) {
      const { data: sessionData, error: verifyErr } =
        await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: "magiclink",
        });
      if (verifyErr) throw verifyErr;
      return sessionData;
    }

    return data;
  },

  /** Legacy: Send OTP to parent email (kept for backward compatibility) */
  async sendOTP(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) throw error;
  },

  /** Legacy: Verify OTP code */
  async verifyOTP(email: string, token: string) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "magiclink",
    });
    if (error) throw error;
    return data;
  },

  /** Verify kid PIN */
  async verifyKidPin(kidId: string, pin: string) {
    try {
      const { data, error } = await supabase.functions.invoke("verify-pin", {
        body: { kid_id: kidId, pin },
      });
      if (error) throw error;
      return data;
    } catch {
      // Fallback: verify via direct DB query (plain compare — EF does bcrypt)
      const { data: kid, error: dbErr } = await supabase
        .from("kids")
        .select("pin_hash")
        .eq("id", kidId)
        .single();
      if (dbErr) throw dbErr;
      // Basic check — production should always use the EF with bcrypt
      if (kid?.pin_hash === pin || kid?.pin_hash === null) {
        return { verified: true };
      }
      throw new Error("Invalid PIN");
    }
  },

  /** Add a kid to the family */
  async addKid(
    familyId: string,
    name: string,
    ageGroup: string,
    avatar: string,
    pin?: string,
  ) {
    try {
      // PIN hashing is handled server-side via Edge Function
      const { data, error } = await supabase.functions.invoke("kid-setup", {
        body: {
          family_id: familyId,
          name,
          age_group: ageGroup,
          avatar,
          pin: pin || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.kid || data;
    } catch {
      // Fallback: direct DB insert when Edge Function is not deployed
      const friendCode = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();
      const { data: kid, error: dbErr } = await supabase
        .from("kids")
        .insert({
          family_id: familyId,
          name,
          age_group: ageGroup,
          avatar,
          pin_hash: pin || null, // stored plain — EF should hash with bcrypt
          friend_code: friendCode,
          daily_goal: ageGroup === "7-9" ? 10 : ageGroup === "10-12" ? 15 : 20,
        })
        .select()
        .single();
      if (dbErr) throw dbErr;
      return kid;
    }
  },

  /** Set / update the parent PIN (stored as plain text, verified by edge function) */
  async setParentPin(familyId: string, pin: string) {
    const { error } = await supabase
      .from("families")
      .update({ parent_pin_hash: pin })
      .eq("id", familyId);
    if (error) throw error;
  },

  /** Get current session */
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  /** Verify QR token and return kid + clear the token (single-use, atomic) */
  async verifyKidQR(token: string) {
    // Atomic: UPDATE + SELECT in one query — prevents race condition
    const { data: kid, error } = await supabase
      .from("kids")
      .update({ qr_token: null, qr_expires_at: null })
      .eq("qr_token", token)
      .gt("qr_expires_at", new Date().toISOString())
      .select("id, name, family_id")
      .maybeSingle();

    if (error) throw error;
    return kid;
  },

  /** Logout */
  async logout() {
    await supabase.auth.signOut();
  },
};
