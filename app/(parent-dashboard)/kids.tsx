import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Modal,
  Animated,
  RefreshControl,
} from "react-native";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { COLORS } from "@/constants/theme";
import { T } from "@/constants/translations";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { useKidStats } from "@/hooks/useKidStats";
import { useWird } from "@/hooks/useWird";
import { useVoiceProfiles } from "@/hooks/useVoiceProfiles";
import { useToast } from "@/hooks/useToast";
import { Toast, ConfirmModal } from "@/components/ui";
import type { ConfirmConfig } from "@/components/ui";
import { authService } from "@/services/auth";
import { supabase } from "@/services/supabase";
import { LinearGradient } from "expo-linear-gradient";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { usePlans } from "@/hooks/usePlans";
import QRCode from "react-native-qrcode-svg";

/* ── Per-kid card with independent stats ── */
function KidCardStats({
  kid,
  isRTL,
  t,
  kids,
  onEditKid,
  onAssignWird,
  onToggleSeasonalWird,
  onManageCustomItems,
  onShowQR,
  onRemove,
  wirdEnabled,
  voiceProfiles,
  onUpdateVoiceProfile,
}: any) {
  const { stats } = useKidStats(kid.id);
  const { items: wirdItems } = useWird(kid.id);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const wirdDone = wirdEnabled
    ? wirdItems.filter((i: any) => i.is_completed).length
    : 0;
  const wirdTotal = wirdEnabled ? wirdItems.length || 0 : 0;
  const wirdPct = wirdTotal > 0 ? Math.round((wirdDone / wirdTotal) * 100) : 0;

  const CARD_GRADIENTS: [string, string][] = [
    ["#EDE9FE", "#DDD6FE"],
    ["#FFF7ED", "#FED7AA"],
    ["#ECFDF5", "#A7F3D0"],
    ["#FEF3C7", "#FDE68A"],
  ];
  const kidIdx =
    kids.findIndex((k: any) => k.id === kid.id) % CARD_GRADIENTS.length;
  const gradColors = CARD_GRADIENTS[kidIdx];

  return (
    <LinearGradient
      colors={gradColors}
      style={styles.kidCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Watermark */}
      <Text style={styles.kidCardWatermark}>
        {kid.avatar || kid.avatar_emoji || "🌟"}
      </Text>

      {/* Header Row */}
      <View style={styles.kidCardHeader}>
        <View style={styles.kidCardAvatarWrap}>
          <Text style={{ fontSize: 38 }}>
            {kid.avatar || kid.avatar_emoji || "🌟"}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kidCardName}>{kid.display_name || kid.name}</Text>
          <Text style={styles.kidCardMeta}>
            🎂 {isRTL ? "العمر:" : "Age:"} {kid.age_group}
          </Text>
          {/* Mini stat pills */}
          <View style={styles.kidMiniPills}>
            <View style={styles.kidMiniPill}>
              <Text style={styles.kidMiniPillText}>🔥 {kid.streak || 0}</Text>
            </View>
            <View
              style={[
                styles.kidMiniPill,
                { backgroundColor: "rgba(245,158,11,0.2)" },
              ]}
            >
              <Text style={styles.kidMiniPillText}>⭐ {kid.stars || 0}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.kidStatsRow}>
        {[
          {
            n: stats?.todayGoal?.completed_count || 0,
            l: isRTL ? "اليوم 🤲" : "Today 🤲",
            c: "#7C3AED",
          },
          {
            n: kid.streak || 0,
            l: isRTL ? "🔥 سلسلة" : "🔥 Streak",
            c: "#EA580C",
          },
          {
            n: kid.stars || 0,
            l: isRTL ? "⭐ نجوم" : "⭐ Stars",
            c: "#D97706",
          },
          ...(wirdEnabled
            ? [
                {
                  n: wirdTotal > 0 ? `${wirdDone}/${wirdTotal}` : "—",
                  l: isRTL ? "📿 الورد" : "📿 Wird",
                  c:
                    wirdTotal > 0 && wirdDone >= wirdTotal
                      ? "#059669"
                      : "#7C3AED",
                },
              ]
            : []),
        ].map((s: any, j) => (
          <View key={j} style={styles.kidStatBox}>
            <Text style={[styles.kidStatNum, { color: s.c }]}>{s.n}</Text>
            <Text style={styles.kidStatLabel}>{s.l}</Text>
          </View>
        ))}
      </View>

      {/* Wird progress bar */}
      {wirdEnabled && wirdTotal > 0 && (
        <View style={styles.kidWirdBarWrap}>
          <View style={styles.kidWirdBarOuter}>
            <LinearGradient
              colors={["#10B981", "#059669"]}
              style={[styles.kidWirdBarFill, { width: `${wirdPct}%` }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
          <Text style={styles.kidWirdBarPct}>{wirdPct}%</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.kidCardActions}>
        <Pressable style={styles.pinBtn} onPress={() => onEditKid(kid)}>
          <Text style={styles.pinBtnText}>
            ✏️ {isRTL ? "تعديل الطفل" : "Edit Kid"}
          </Text>
        </Pressable>
        {wirdEnabled && (
          <Pressable style={{ flex: 1 }} onPress={() => onAssignWird(kid)}>
            <LinearGradient
              colors={["#7C3AED", "#9333EA"]}
              style={styles.wirdBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.wirdBtnText}>{t.assignWird}</Text>
            </LinearGradient>
          </Pressable>
        )}
      </View>

      {/* QR Login Button */}
      <Pressable style={styles.qrBtn} onPress={() => onShowQR(kid)}>
        <Text style={styles.qrBtnText}>
          📱 {isRTL ? "عرض رمز QR للدخول" : "Show QR Login Code"}
        </Text>
      </Pressable>

      {/* Seasonal Wird Toggle */}
      {wirdEnabled && (
        <Pressable
          style={styles.seasonalToggleRow}
          onPress={() => onToggleSeasonalWird(kid)}
        >
          <Text style={styles.seasonalToggleLabel}>
            🌙 {t.showSeasonalWird}
          </Text>
          <View
            style={[
              styles.seasonalToggleTrack,
              kid.show_seasonal_wird !== false && styles.seasonalToggleTrackOn,
            ]}
          >
            <View
              style={[
                styles.seasonalToggleThumb,
                kid.show_seasonal_wird !== false &&
                  styles.seasonalToggleThumbOn,
              ]}
            />
          </View>
        </Pressable>
      )}

      {/* Custom Seasonal Items Button*/}
      {wirdEnabled && (
        <Pressable
          style={styles.customSeasonalBtn}
          onPress={() => onManageCustomItems(kid)}
        >
          <Text style={styles.customSeasonalBtnText}>
            ✏️ {t.manageCustomSeasonal}
          </Text>
        </Pressable>
      )}

      {/* Voice Preference */}
      {voiceProfiles && voiceProfiles.length > 0 && (
        <>
          <Pressable
            style={styles.seasonalToggleRow}
            onPress={() => setShowVoicePicker(true)}
          >
            <Text style={styles.seasonalToggleLabel}>
              🎙️ {isRTL ? "صوت القارئ" : "Voice Preference"}
            </Text>
            <Text style={{ fontSize: 12, color: "#7C3AED", fontWeight: "700" }}>
              {kid.preferred_voice_profile_id
                ? voiceProfiles.find(
                    (p: any) => p.id === kid.preferred_voice_profile_id,
                  )?.name_ar ||
                  voiceProfiles.find(
                    (p: any) => p.id === kid.preferred_voice_profile_id,
                  )?.name_en ||
                  (isRTL ? "مخصص" : "Custom")
                : isRTL
                  ? "افتراضي"
                  : "Default"}
              {" ›"}
            </Text>
          </Pressable>

          <Modal
            visible={showVoicePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowVoicePicker(false)}
          >
            <Pressable
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.5)",
                justifyContent: "center",
                alignItems: "center",
              }}
              onPress={() => setShowVoicePicker(false)}
            >
              <View
                style={{
                  backgroundColor: "#1E1B3A",
                  borderRadius: 16,
                  padding: 20,
                  width: "80%",
                  maxWidth: 340,
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "800",
                    color: "#F0EAD6",
                    marginBottom: 8,
                    textAlign: "center",
                  }}
                >
                  {isRTL ? "اختر القارئ" : "Choose Voice Profile"}
                </Text>

                {/* Default option */}
                <Pressable
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: !kid.preferred_voice_profile_id
                      ? "rgba(124,58,237,0.25)"
                      : "rgba(255,255,255,0.06)",
                  }}
                  onPress={() => {
                    onUpdateVoiceProfile(kid.id, null);
                    setShowVoicePicker(false);
                  }}
                >
                  <Text
                    style={{
                      color: "#F0EAD6",
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    {isRTL ? "الافتراضي (حسب الذكر)" : "Default (per dhikr)"}
                  </Text>
                </Pressable>

                {/* Profile options */}
                {voiceProfiles.map((p: any) => (
                  <Pressable
                    key={p.id}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor:
                        kid.preferred_voice_profile_id === p.id
                          ? "rgba(124,58,237,0.25)"
                          : "rgba(255,255,255,0.06)",
                    }}
                    onPress={() => {
                      onUpdateVoiceProfile(kid.id, p.id);
                      setShowVoicePicker(false);
                    }}
                  >
                    <Text
                      style={{
                        color: "#F0EAD6",
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      {p.name_ar}
                    </Text>
                    <Text
                      style={{ color: "#94A3B8", fontSize: 11, marginTop: 2 }}
                    >
                      {p.name_en}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Modal>
        </>
      )}

      {/* Remove */}
      {kids.length > 1 && (
        <Pressable
          style={styles.removeKidBtn}
          onPress={() => onRemove(kid.id, kid.display_name || kid.name)}
        >
          <Text style={styles.removeKidText}>🗑 {t.removeKid}</Text>
        </Pressable>
      )}
    </LinearGradient>
  );
}

const AVATARS = [
  "🦁",
  "🦋",
  "🦅",
  "🌸",
  "🐻",
  "🌺",
  "🐯",
  "🌈",
  "⚽",
  "🎨",
  "🦄",
  "🐬",
];

export default function KidsScreen() {
  const router = useRouter();
  const { family, kids, activeKid, refreshKids } = useAuth();
  const { lang } = useLang();
  const isRTL = lang === "ar";
  const t = T[lang];
  const flags = useFeatureFlags();
  const { plans } = usePlans();
  const { profiles: voiceProfiles } = useVoiceProfiles();

  const [selectedKid, setSelectedKid] = useState(0);
  const kidLabelAnim = useRef(new Animated.Value(1)).current;
  const { toast, showToast } = useToast();
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);

  const [showAddKid, setShowAddKid] = useState(false);
  const [showEditKid, setShowEditKid] = useState<number | null>(null);
  const [showWirdAssign, setShowWirdAssign] = useState<number | null>(null);
  const [editKidName, setEditKidName] = useState("");
  const [editKidAge, setEditKidAge] = useState("");
  const [editKidAvatar, setEditKidAvatar] = useState("🦁");
  const [editKidPin, setEditKidPin] = useState("");
  const [editKidSaving, setEditKidSaving] = useState(false);

  const [newKidName, setNewKidName] = useState("");
  const [newKidAge, setNewKidAge] = useState("");
  const [newKidAvatar, setNewKidAvatar] = useState("🦁");
  const [newKidPin, setNewKidPin] = useState("");
  const [addingKid, setAddingKid] = useState(false);

  const [wirdTemplates, setWirdTemplates] = useState<any[]>([]);
  const [selectedWirdTemplate, setSelectedWirdTemplate] = useState<
    number | null
  >(null);
  const [wirdMode, setWirdMode] = useState<"template" | "custom">("template");
  const [allAdhkar, setAllAdhkar] = useState<any[]>([]);
  const [adhkarLoading, setAdhkarLoading] = useState(false);
  const [adhkarSearch, setAdhkarSearch] = useState("");
  const [customAdhkarIds, setCustomAdhkarIds] = useState<number[]>([]);
  const DISPLAY_ADHKAR_LIMIT = 80;

  const [activeOtp, setActiveOtp] = useState<{
    otp_code: string;
    expires_at: string;
  } | null>(null);

  const [qrKid, setQrKid] = useState<any | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<string | null>(null);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(0);
  const [qrLoading, setQrLoading] = useState(false);
  const qrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [customSeasonalKid, setCustomSeasonalKid] = useState<any | null>(null);
  const [newKidCustomAr, setNewKidCustomAr] = useState("");
  const [newKidCustomEn, setNewKidCustomEn] = useState("");

  useEffect(() => {
    if (family?.id) loadActiveOtp();
    const interval = setInterval(() => {
      if (family?.id) loadActiveOtp();
    }, 15000);
    return () => clearInterval(interval);
  }, [family?.id]);

  useEffect(() => {
    loadWirdTemplates();
  }, []);

  const loadWirdTemplates = async () => {
    const { data } = await supabase
      .from("wird_templates")
      .select("id, name_en, name_ar, age_group")
      .eq("is_active", true)
      .order("id");
    setWirdTemplates(data || []);
  };

  const loadAllAdhkar = async () => {
    setAdhkarLoading(true);
    setAllAdhkar([]);
    try {
      const { data, error } = await supabase
        .from("adhkar")
        .select("id, text_ar, meaning_en, category_id")
        .order("id");
      if (error) throw error;
      setAllAdhkar(data || []);
    } catch (e) {
      setAllAdhkar([]);
    } finally {
      setAdhkarLoading(false);
    }
  };

  const loadActiveOtp = async () => {
    if (!family?.id) return;
    try {
      const { data } = await supabase
        .from("kid_login_otps")
        .select("otp_code, expires_at")
        .eq("family_id", family.id)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      setActiveOtp(data);
    } catch {
      setActiveOtp(null);
    }
  };

  const generateQR = useCallback(
    async (kidId: string) => {
      setQrLoading(true);
      try {
        const token = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
          /[xy]/g,
          (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
          },
        );
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        const { error } = await supabase
          .from("kids")
          .update({ qr_token: token, qr_expires_at: expiresAt })
          .eq("id", kidId);
        if (error) throw error;
        setQrToken(token);
        setQrExpiresAt(expiresAt);
        setQrSecondsLeft(
          Math.max(
            0,
            Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
          ),
        );
      } catch (e) {
        console.error("Failed to generate QR:", e);
        showToast(
          isRTL ? "فشل إنشاء رمز QR" : "Failed to generate QR",
          "error",
        );
      }
      setQrLoading(false);
    },
    [isRTL],
  );

  const handleShowQR = useCallback(
    (kid: any) => {
      setQrKid(kid);
      setQrToken(null);
      setQrExpiresAt(null);
      setQrSecondsLeft(0);
      generateQR(kid.id);
    },
    [generateQR],
  );

  const handleCloseQR = useCallback(() => {
    setQrKid(null);
    setQrToken(null);
    setQrExpiresAt(null);
    setQrSecondsLeft(0);
    if (qrTimerRef.current) clearInterval(qrTimerRef.current);
  }, []);

  // QR countdown timer
  useEffect(() => {
    if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    if (!qrExpiresAt || !qrKid) return;

    qrTimerRef.current = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(qrExpiresAt).getTime() - Date.now()) / 1000),
      );
      setQrSecondsLeft(remaining);
      if (remaining <= 0 && qrKid) {
        generateQR(qrKid.id);
      }
    }, 1000);

    return () => {
      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    };
  }, [qrExpiresAt, qrKid, generateQR]);

  const currentPlan = plans.find((p) => p.id === family?.plan_id);
  const maxKids = family?.max_kids ?? currentPlan?.max_kids ?? 1;
  const canAddKid = kids.length < maxKids;

  const handleAddKid = async () => {
    if (!canAddKid) {
      showToast(
        isRTL
          ? `وصلت للحد الأقصى (${maxKids} أطفال). يرجى ترقية خطتك.`
          : `Kid limit reached (${maxKids}). Please upgrade your plan.`,
        "error",
      );
      setShowAddKid(false);
      return;
    }
    if (
      !newKidName ||
      !newKidAge ||
      !newKidPin ||
      newKidPin.length !== 4 ||
      !family?.id
    ) {
      if (!newKidPin || newKidPin.length !== 4) {
        showToast(
          isRTL
            ? "يرجى إدخال رمز PIN مكون من 4 أرقام"
            : "Please enter a 4-digit PIN",
          "error",
        );
        return;
      }
      return;
    }
    setAddingKid(true);
    try {
      await authService.addKid(
        family.id,
        newKidName,
        newKidAge,
        newKidAvatar,
        newKidPin,
      );
      await refreshKids();
      showToast(t.kidAdded);
      setShowAddKid(false);
      setNewKidName("");
      setNewKidAge("");
      setNewKidAvatar("🦁");
      setNewKidPin("");
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setAddingKid(false);
    }
  };

  const handleEditKidSave = async () => {
    if (!editKidName.trim() || !editKidAge || showEditKid === null) return;
    const k = kids[showEditKid];
    if (!k) return;
    setEditKidSaving(true);
    try {
      const updates: any = {
        name: editKidName.trim(),
        age_group: editKidAge,
        avatar: editKidAvatar,
      };
      if (editKidPin.length === 4) updates.pin_hash = editKidPin;
      const { error } = await supabase
        .from("kids")
        .update(updates)
        .eq("id", k.id);
      if (error) throw error;
      showToast(isRTL ? "تم تحديث بيانات الطفل" : "Kid updated");
      setShowEditKid(null);
      await refreshKids();
    } catch {
      showToast(isRTL ? "فشل التحديث" : "Failed to update", "error");
    } finally {
      setEditKidSaving(false);
    }
  };

  const handleWirdSave = async () => {
    if (showWirdAssign === null) return;
    const k = kids[showWirdAssign];
    if (!k) return;
    try {
      if (wirdMode === "template") {
        const { error } = await supabase
          .from("kids")
          .update({
            wird_template_id: selectedWirdTemplate,
            custom_adhkar_ids: [],
          })
          .eq("id", k.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("kids")
          .update({
            wird_template_id: null,
            custom_adhkar_ids: customAdhkarIds,
          })
          .eq("id", k.id);
        if (error) throw error;
      }
      await refreshKids();
      showToast(t.wirdSaved);
      setShowWirdAssign(null);
    } catch {
      showToast(isRTL ? "فشل حفظ الورد" : "Failed to assign wird", "error");
    }
  };

  const toggleCustomAdhkar = (adhkarId: number) => {
    setCustomAdhkarIds((prev) =>
      prev.includes(adhkarId)
        ? prev.filter((id) => id !== adhkarId)
        : [...prev, adhkarId],
    );
  };

  const handleRemoveKid = (kidId: string, kidName: string) => {
    if (kids.length <= 1) return;
    setConfirm({
      title: isRTL ? "حذف الطفل" : "Remove Child",
      message: isRTL ? `هل تريد حذف ${kidName}؟` : `Remove ${kidName}?`,
      confirmText: t.removeKid,
      cancelText: t.cancel,
      destructive: true,
      onConfirm: async () => {
        try {
          await supabase.from("kids").delete().eq("id", kidId);
          await refreshKids();
          if (selectedKid >= kids.length - 1) setSelectedKid(0);
          showToast(t.childRemoved);
        } catch {}
      },
    });
  };

  const handleToggleSeasonalWird = async (kid: any) => {
    const newValue = kid.show_seasonal_wird === false ? true : false;
    try {
      const { error } = await supabase
        .from("kids")
        .update({ show_seasonal_wird: newValue })
        .eq("id", kid.id);
      if (error) throw error;
      await refreshKids();
      showToast(t.seasonalWirdSaved);
    } catch {
      showToast(isRTL ? "فشل التحديث" : "Failed to update", "error");
    }
  };

  const handleUpdateVoiceProfile = async (
    kidId: string,
    profileId: number | null,
  ) => {
    try {
      const { error } = await supabase
        .from("kids")
        .update({ preferred_voice_profile_id: profileId })
        .eq("id", kidId);
      if (error) throw error;
      await refreshKids();
    } catch {
      showToast(
        isRTL ? "فشل تحديث الصوت" : "Failed to update voice preference",
        "error",
      );
    }
  };

  const handleSaveCustomSeasonalItems = async (kid: any, items: any[]) => {
    const { error } = await supabase
      .from("kids")
      .update({ seasonal_custom_items: items })
      .eq("id", kid.id);
    if (error) throw error;
    await refreshKids();
  };

  const handleAddKidCustomItem = async () => {
    if (!newKidCustomAr.trim() || !customSeasonalKid) return;
    const newItem: any = {
      id: "k_" + Date.now(),
      text_ar: newKidCustomAr.trim(),
      repeat: 1,
    };
    if (newKidCustomEn.trim()) newItem.text_en = newKidCustomEn.trim();
    const existing = Array.isArray(customSeasonalKid.seasonal_custom_items)
      ? customSeasonalKid.seasonal_custom_items
      : [];
    const updated = [...existing, newItem];
    try {
      await handleSaveCustomSeasonalItems(customSeasonalKid, updated);
      setCustomSeasonalKid((prev: any) => ({
        ...prev,
        seasonal_custom_items: updated,
      }));
      setNewKidCustomAr("");
      setNewKidCustomEn("");
      showToast(t.customItemAdded);
    } catch {
      showToast(isRTL ? "فشل الحفظ" : "Failed to save", "error");
    }
  };

  const handleRemoveKidCustomItem = async (itemId: string) => {
    if (!customSeasonalKid) return;
    const existing = Array.isArray(customSeasonalKid.seasonal_custom_items)
      ? customSeasonalKid.seasonal_custom_items
      : [];
    const updated = existing.filter((item: any) => item.id !== itemId);
    try {
      await handleSaveCustomSeasonalItems(customSeasonalKid, updated);
      setCustomSeasonalKid((prev: any) => ({
        ...prev,
        seasonal_custom_items: updated,
      }));
      showToast(t.customItemRemoved);
    } catch {
      showToast(isRTL ? "فشل الحذف" : "Failed to remove", "error");
    }
  };

  const handleSelectKid = (i: number) => {
    setSelectedKid(i);
    kidLabelAnim.setValue(0);
    Animated.spring(kidLabelAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  };

  const AGE_GROUPS = ["4-6", "7-9", "10-12"];

  return (
    <View style={{ flex: 1, backgroundColor: "#FFF7ED" }}>
      <Toast toast={toast} />
      <ConfirmModal config={confirm} onClose={() => setConfirm(null)} />

      {/* ━━━ ADD KID MODAL ━━━ */}
      <Modal visible={showAddKid} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setShowAddKid(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>🌟 {t.addKidBtn}</Text>

            {/* Avatar Picker */}
            <Text style={styles.label}>
              {isRTL ? "🎭 اختر الشخصية" : "🎭 Pick Avatar"}
            </Text>
            <View style={styles.avatarGrid}>
              {AVATARS.map((a) => (
                <Pressable
                  key={a}
                  style={[
                    styles.avatarBtn,
                    newKidAvatar === a && styles.avatarBtnActive,
                  ]}
                  onPress={() => setNewKidAvatar(a)}
                >
                  <Text style={{ fontSize: 26 }}>{a}</Text>
                </Pressable>
              ))}
            </View>

            {/* Name */}
            <Text style={styles.label}>✏️ {t.kidName}</Text>
            <TextInput
              style={[styles.input, isRTL && { textAlign: "right" }]}
              value={newKidName}
              onChangeText={setNewKidName}
              placeholder={isRTL ? "اسم الطفل" : "Child's name"}
              placeholderTextColor="#A78BFA"
            />

            {/* PIN */}
            <Text style={[styles.label, { marginTop: 12 }]}>
              🔑 {isRTL ? "رمز PIN (4 أرقام)" : "PIN (4 digits)"}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  textAlign: "center",
                  letterSpacing: 8,
                  fontSize: 24,
                  marginTop: 4,
                },
              ]}
              value={newKidPin}
              onChangeText={(v) => setNewKidPin(v.replace(/\D/g, ""))}
              maxLength={4}
              keyboardType="number-pad"
              secureTextEntry
              placeholder="••••"
              placeholderTextColor="#A78BFA"
            />

            {/* Age */}
            <Text style={[styles.label, { marginTop: 12 }]}>🎂 {t.kidAge}</Text>
            <View style={styles.ageRow}>
              {AGE_GROUPS.map((a) => (
                <Pressable
                  key={a}
                  onPress={() => setNewKidAge(a)}
                  style={{ flex: 1 }}
                >
                  {newKidAge === a ? (
                    <LinearGradient
                      colors={["#7C3AED", "#9333EA"]}
                      style={styles.ageBtnActive}
                    >
                      <Text style={styles.ageBtnTextActive}>{a}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.ageBtn}>
                      <Text style={styles.ageBtnText}>{a}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>

            <View style={styles.sheetButtons}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setShowAddKid(false)}
              >
                <Text style={styles.cancelBtnText}>❌ {t.cancel}</Text>
              </Pressable>
              <Pressable
                style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}
                onPress={handleAddKid}
                disabled={
                  !newKidName ||
                  !newKidAge ||
                  newKidPin.length !== 4 ||
                  addingKid
                }
              >
                <LinearGradient
                  colors={["#F97316", "#FB923C"]}
                  style={[
                    styles.saveBtn,
                    (!newKidName || !newKidAge || newKidPin.length !== 4) && {
                      opacity: 0.4,
                    },
                  ]}
                >
                  <Text style={styles.saveBtnText}>
                    {addingKid ? "⏳ ..." : `🚀 ${t.save}`}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ━━━ EDIT KID MODAL ━━━ */}
      <Modal visible={showEditKid !== null} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setShowEditKid(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              ✏️ {isRTL ? "تعديل الطفل" : "Edit Kid"}
            </Text>
            {showEditKid !== null && kids[showEditKid] && (
              <Text style={styles.sheetSub}>
                {editKidAvatar}{" "}
                {kids[showEditKid].display_name || kids[showEditKid].name}
              </Text>
            )}

            <ScrollView
              style={{ maxHeight: 420 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Avatar */}
              <Text style={[styles.label, { marginTop: 12 }]}>
                {isRTL ? "🎭 اختر الشخصية" : "🎭 Pick Avatar"}
              </Text>
              <View style={styles.avatarGrid}>
                {AVATARS.map((a) => (
                  <Pressable
                    key={a}
                    style={[
                      styles.avatarBtn,
                      editKidAvatar === a && styles.avatarBtnActive,
                    ]}
                    onPress={() => setEditKidAvatar(a)}
                  >
                    <Text style={{ fontSize: 26 }}>{a}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Name */}
              <Text style={[styles.label, { marginTop: 12 }]}>
                ✏️ {t.kidName}
              </Text>
              <TextInput
                style={[styles.input, isRTL && { textAlign: "right" }]}
                value={editKidName}
                onChangeText={setEditKidName}
                placeholder={isRTL ? "اسم الطفل" : "Child's name"}
                placeholderTextColor="#A78BFA"
              />

              {/* Age */}
              <Text style={[styles.label, { marginTop: 12 }]}>
                🎂 {t.kidAge}
              </Text>
              <View style={styles.ageRow}>
                {AGE_GROUPS.map((a) => (
                  <Pressable
                    key={a}
                    onPress={() => setEditKidAge(a)}
                    style={{ flex: 1 }}
                  >
                    {editKidAge === a ? (
                      <LinearGradient
                        colors={["#7C3AED", "#9333EA"]}
                        style={styles.ageBtnActive}
                      >
                        <Text style={styles.ageBtnTextActive}>{a}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.ageBtn}>
                        <Text style={styles.ageBtnText}>{a}</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>

              {/* PIN (optional) */}
              <Text style={[styles.label, { marginTop: 12 }]}>
                🔑 {isRTL ? "PIN جديد (اختياري)" : "New PIN (optional)"}
              </Text>
              <TextInput
                style={[styles.input, styles.pinInput, { marginTop: 4 }]}
                value={editKidPin}
                onChangeText={(v) => setEditKidPin(v.replace(/\D/g, ""))}
                maxLength={4}
                keyboardType="number-pad"
                secureTextEntry
                placeholder={
                  isRTL ? "اتركه فارغاً للإبقاء" : "Leave blank to keep"
                }
                placeholderTextColor="#A78BFA"
              />
            </ScrollView>

            <View style={[styles.sheetButtons, { marginTop: 16 }]}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setShowEditKid(null)}
              >
                <Text style={styles.cancelBtnText}>❌ {t.cancel}</Text>
              </Pressable>
              <Pressable
                style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}
                onPress={handleEditKidSave}
                disabled={!editKidName.trim() || !editKidAge || editKidSaving}
              >
                <LinearGradient
                  colors={["#7C3AED", "#9333EA"]}
                  style={[
                    styles.saveBtn,
                    (!editKidName.trim() || !editKidAge) && { opacity: 0.4 },
                  ]}
                >
                  <Text style={styles.saveBtnText}>
                    {editKidSaving ? "⏳ ..." : `✅ ${t.save}`}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ━━━ WIRD ASSIGN MODAL ━━━ */}
      {flags.wird && (
        <Modal
          visible={showWirdAssign !== null}
          transparent
          animationType="slide"
        >
          <Pressable
            style={styles.overlay}
            onPress={() => setShowWirdAssign(null)}
          >
            <Pressable style={styles.sheet} onPress={() => {}}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>📿 {t.assignWird}</Text>
              {showWirdAssign !== null && kids[showWirdAssign] && (
                <>
                  <Text style={[styles.sheetSub, { color: "#7C3AED" }]}>
                    {t.wirdFor} {kids[showWirdAssign].avatar || "🌟"}{" "}
                    {kids[showWirdAssign].display_name ||
                      kids[showWirdAssign].name}
                  </Text>
                  <Text style={styles.sheetHint}>
                    {isRTL
                      ? "اختر قالباً أو أذكاراً مخصصة"
                      : "Use a template or pick custom dhikrs"}
                  </Text>
                </>
              )}

              {/* Mode Toggle */}
              <View style={styles.wirdModeToggle}>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => setWirdMode("template")}
                >
                  {wirdMode === "template" ? (
                    <LinearGradient
                      colors={["#7C3AED", "#9333EA"]}
                      style={styles.wirdModeActive}
                    >
                      <Text style={styles.wirdModeActiveText}>
                        📋 {isRTL ? "قالب جاهز" : "Template"}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.wirdModeInactive}>
                      <Text style={styles.wirdModeInactiveText}>
                        📋 {isRTL ? "قالب جاهز" : "Template"}
                      </Text>
                    </View>
                  )}
                </Pressable>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => {
                    setWirdMode("custom");
                    setAdhkarSearch("");
                    if (allAdhkar.length === 0) loadAllAdhkar();
                  }}
                >
                  {wirdMode === "custom" ? (
                    <LinearGradient
                      colors={["#F97316", "#FB923C"]}
                      style={styles.wirdModeActive}
                    >
                      <Text style={styles.wirdModeActiveText}>
                        ✨ {isRTL ? "مخصص" : "Custom"}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.wirdModeInactive}>
                      <Text style={styles.wirdModeInactiveText}>
                        ✨ {isRTL ? "مخصص" : "Custom"}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>

              {wirdMode === "custom" && (
                <TextInput
                  style={[
                    styles.input,
                    {
                      marginTop: 10,
                      marginBottom: 4,
                      textAlign: isRTL ? "right" : "left",
                    },
                  ]}
                  value={adhkarSearch}
                  onChangeText={setAdhkarSearch}
                  placeholder={
                    isRTL ? "🔍 بحث في الأذكار..." : "🔍 Search dhikrs..."
                  }
                  placeholderTextColor="#A78BFA"
                />
              )}

              <ScrollView style={{ maxHeight: 240, marginTop: 8 }}>
                {wirdMode === "template" ? (
                  wirdTemplates.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={{ fontSize: 32 }}>📭</Text>
                      <Text style={styles.emptyStateText}>
                        {isRTL
                          ? "لا توجد قوالب متاحة"
                          : "No templates available"}
                      </Text>
                    </View>
                  ) : (
                    wirdTemplates.map((tpl: any) => {
                      const tplName = isRTL ? tpl.name_ar : tpl.name_en;
                      const isSelected = selectedWirdTemplate === tpl.id;
                      return (
                        <Pressable
                          key={tpl.id}
                          style={[
                            styles.catRow,
                            isSelected && styles.catRowActive,
                          ]}
                          onPress={() => setSelectedWirdTemplate(tpl.id)}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Text style={styles.catName}>{tplName}</Text>
                            <View style={styles.agePill}>
                              <Text style={styles.agePillText}>
                                {tpl.age_group}
                              </Text>
                            </View>
                          </View>
                          <View
                            style={[
                              styles.checkbox,
                              isSelected && styles.checkboxActive,
                            ]}
                          >
                            {isSelected && (
                              <Text style={{ color: "#fff", fontSize: 14 }}>
                                ✓
                              </Text>
                            )}
                          </View>
                        </Pressable>
                      );
                    })
                  )
                ) : adhkarLoading ? (
                  <View style={styles.emptyState}>
                    <Text style={{ fontSize: 32 }}>⏳</Text>
                    <Text style={styles.emptyStateText}>
                      {isRTL ? "جاري التحميل..." : "Loading..."}
                    </Text>
                  </View>
                ) : (
                  (() => {
                    const q = (adhkarSearch || "").trim().toLowerCase();
                    const filtered = q
                      ? allAdhkar.filter((a: any) => {
                          return (
                            (a.text_ar || "").toLowerCase().includes(q) ||
                            (a.meaning_en || "").toLowerCase().includes(q)
                          );
                        })
                      : allAdhkar;
                    const toShow = filtered.slice(0, DISPLAY_ADHKAR_LIMIT);
                    if (toShow.length === 0) {
                      return (
                        <View style={styles.emptyState}>
                          <Text style={{ fontSize: 32 }}>🌱</Text>
                          <Text style={styles.emptyStateText}>
                            {allAdhkar.length === 0
                              ? isRTL
                                ? "لا توجد أذكار متاحة"
                                : "No adhkar available"
                              : isRTL
                                ? "لا نتائج للبحث"
                                : "No results"}
                          </Text>
                        </View>
                      );
                    }
                    return (
                      <>
                        {toShow.map((a: any) => {
                          const isSelected = customAdhkarIds.includes(a.id);
                          const label =
                            (isRTL ? a.text_ar : a.meaning_en) ||
                            a.text_ar ||
                            "";
                          return (
                            <Pressable
                              key={a.id}
                              style={[
                                styles.catRow,
                                isSelected && styles.catRowActive,
                              ]}
                              onPress={() => toggleCustomAdhkar(a.id)}
                            >
                              <Text
                                style={[styles.catName, { flex: 1 }]}
                                numberOfLines={2}
                              >
                                {label}
                              </Text>
                              <View
                                style={[
                                  styles.checkbox,
                                  isSelected && styles.checkboxActive,
                                ]}
                              >
                                {isSelected && (
                                  <Text style={{ color: "#fff", fontSize: 14 }}>
                                    ✓
                                  </Text>
                                )}
                              </View>
                            </Pressable>
                          );
                        })}
                        {filtered.length > DISPLAY_ADHKAR_LIMIT && (
                          <Text
                            style={{
                              fontSize: 11,
                              color: "#A78BFA",
                              textAlign: "center",
                              paddingVertical: 8,
                              fontWeight: "700",
                            }}
                          >
                            {isRTL
                              ? `عرض ${DISPLAY_ADHKAR_LIMIT} من ${filtered.length}`
                              : `Showing ${DISPLAY_ADHKAR_LIMIT} of ${filtered.length}`}
                          </Text>
                        )}
                      </>
                    );
                  })()
                )}
              </ScrollView>

              <Pressable
                style={{ borderRadius: 18, overflow: "hidden", marginTop: 12 }}
                onPress={handleWirdSave}
              >
                <LinearGradient
                  colors={["#10B981", "#059669"]}
                  style={styles.fullSaveBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.saveBtnText}>💾 {t.save}</Text>
                </LinearGradient>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ━━━ QR CODE MODAL ━━━ */}
      <Modal visible={qrKid !== null} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={handleCloseQR}>
          <Pressable style={styles.qrSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={{ fontSize: 48, textAlign: "center" }}>
              {qrKid?.avatar || qrKid?.avatar_emoji || "🌟"}
            </Text>
            <Text style={styles.sheetTitle}>
              {qrKid?.display_name || qrKid?.name}
            </Text>
            <Text style={styles.sheetSub}>
              {isRTL
                ? "امسح رمز QR من جهاز الطفل لتسجيل الدخول"
                : "Scan this QR from the kid's device to log in"}
            </Text>

            <View style={styles.qrCodeWrap}>
              {qrLoading || !qrToken ? (
                <Text style={{ fontSize: 40 }}>⏳</Text>
              ) : (
                <QRCode
                  value={`tasbih://kid-login?token=${qrToken}`}
                  size={200}
                  backgroundColor="#ffffff"
                  color="#0F1E35"
                />
              )}
            </View>

            <View style={styles.qrTimerWrap}>
              <Text
                style={[
                  styles.qrCountdown,
                  qrSecondsLeft < 30 && styles.qrCountdownWarning,
                ]}
              >
                {Math.floor(qrSecondsLeft / 60)}:
                {(qrSecondsLeft % 60).toString().padStart(2, "0")}
              </Text>
              <Text style={styles.qrTimerLabel}>
                {isRTL
                  ? "يتجدد تلقائياً عند الانتهاء"
                  : "Auto-refreshes when expired"}
              </Text>
            </View>

            <Pressable
              style={styles.qrRegenerateBtn}
              onPress={() => qrKid && generateQR(qrKid.id)}
            >
              <Text style={styles.qrRegenerateBtnText}>
                🔄 {isRTL ? "تجديد الرمز" : "Regenerate"}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ━━━ CUSTOM SEASONAL ITEMS MODAL ━━━ */}
      <Modal
        visible={customSeasonalKid !== null}
        transparent
        animationType="slide"
      >
        <Pressable
          style={styles.overlay}
          onPress={() => {
            setCustomSeasonalKid(null);
            setNewKidCustomAr("");
            setNewKidCustomEn("");
          }}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>✏️ {t.manageCustomSeasonal}</Text>
            {customSeasonalKid && (
              <Text style={styles.sheetSub}>
                {customSeasonalKid.avatar || "🌟"}{" "}
                {customSeasonalKid.display_name || customSeasonalKid.name}
              </Text>
            )}

            {/* Existing items list */}
            <ScrollView style={{ maxHeight: 200, marginTop: 12 }}>
              {customSeasonalKid &&
              Array.isArray(customSeasonalKid.seasonal_custom_items) &&
              customSeasonalKid.seasonal_custom_items.length > 0 ? (
                customSeasonalKid.seasonal_custom_items.map((item: any) => (
                  <View key={item.id} style={styles.customItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.customItemTextAr}>
                        {item.text_ar}
                      </Text>
                      {item.text_en ? (
                        <Text style={styles.customItemTextEn}>
                          {item.text_en}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      style={styles.customItemRemoveBtn}
                      onPress={() => handleRemoveKidCustomItem(item.id)}
                    >
                      <Text style={{ color: "#EF4444", fontSize: 18 }}>✕</Text>
                    </Pressable>
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 28 }}>🌱</Text>
                  <Text style={styles.emptyStateText}>{t.noCustomItems}</Text>
                </View>
              )}
            </ScrollView>

            {/* Add new item form */}
            <View style={styles.customItemForm}>
              <Text style={[styles.label, { marginBottom: 4 }]}>
                {t.customTextAr} *
              </Text>
              <TextInput
                style={[styles.input, { textAlign: "right", marginBottom: 8 }]}
                value={newKidCustomAr}
                onChangeText={setNewKidCustomAr}
                placeholder={
                  isRTL
                    ? "مثال: اللهم صلّ على النبي"
                    : "e.g. اللهم صلّ على النبي"
                }
                placeholderTextColor="#A78BFA"
              />
              <Text style={[styles.label, { marginBottom: 4 }]}>
                {t.customTextEn}
              </Text>
              <TextInput
                style={[styles.input, { marginBottom: 12 }]}
                value={newKidCustomEn}
                onChangeText={setNewKidCustomEn}
                placeholder="e.g. O Allah, bless the Prophet"
                placeholderTextColor="#A78BFA"
              />
              <Pressable
                style={{ borderRadius: 16, overflow: "hidden" }}
                onPress={handleAddKidCustomItem}
                disabled={!newKidCustomAr.trim()}
              >
                <LinearGradient
                  colors={
                    newKidCustomAr.trim()
                      ? ["#7C3AED", "#9333EA"]
                      : ["#D1D5DB", "#D1D5DB"]
                  }
                  style={styles.fullSaveBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.saveBtnText}>➕ {t.addCustomItem}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ━━━ HERO HEADER ━━━ */}
      <LinearGradient
        colors={["#7C3AED", "#9333EA", "#C026D3"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerWatermark}>👶</Text>

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.appName}>{t.appName}</Text>
            <Text style={styles.appSub}>👨‍👩‍👧 {t.parentApp}</Text>
          </View>
        </View>

        {/* Kid Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ paddingBottom: 10, direction: "ltr" }}
          contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
        >
          {kids.map((k: any, i: number) => {
            const active = selectedKid === i;
            const avatar = k.avatar || k.avatar_emoji || "🌟";
            return (
              <Pressable key={k.id} onPress={() => handleSelectKid(i)}>
                {active ? (
                  <LinearGradient
                    colors={["#F97316", "#FB923C"]}
                    style={styles.kidPillActive}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={{ fontSize: 18 }}>{avatar}</Text>
                    <Text style={styles.kidPillNameActive}>
                      {k.display_name || k.name}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.kidPill}>
                    <Text style={{ fontSize: 18 }}>{avatar}</Text>
                    <Text style={styles.kidPillName}>
                      {k.display_name || k.name}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {/* ━━━ CONTENT ━━━ */}
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={async () => {
              await refreshKids();
            }}
            tintColor="#7C3AED"
            colors={["#7C3AED"]}
          />
        }
      >
        {/* OTP Banner */}
        {activeOtp && (
          <LinearGradient
            colors={["#FEF3C7", "#FDE68A"]}
            style={styles.otpBanner}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.otpBannerIcon}>🔑</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.otpBannerTitle}>
                {isRTL ? "طلب دخول طفلك" : "Kid Login Request"}
              </Text>
              <Text style={styles.otpBannerDesc}>
                {isRTL
                  ? "شارك هذا الرمز مع طفلك:"
                  : "Share this code with your child:"}
              </Text>
              <View style={styles.otpCodePill}>
                <Text style={styles.otpBannerCode}>{activeOtp.otp_code}</Text>
              </View>
              <Text style={styles.otpBannerExpiry}>
                ⏱ {isRTL ? "ينتهي خلال 5 دقائق" : "Expires in 5 minutes"}
              </Text>
            </View>
          </LinearGradient>
        )}

        {/* Kid Cards */}
        {kids.map((k: any, i: number) => (
          <KidCardStats
            key={k.id}
            kid={k}
            isRTL={isRTL}
            t={t}
            kids={kids}
            onEditKid={() => {
              setShowEditKid(i);
              setEditKidName(k.name || k.display_name || "");
              setEditKidAge(k.age_group || "");
              setEditKidAvatar(k.avatar || "🦁");
              setEditKidPin("");
            }}
            onShowQR={handleShowQR}
            onAssignWird={() => {
              setShowWirdAssign(i);
              const customIds = Array.isArray(k.custom_adhkar_ids)
                ? (k.custom_adhkar_ids as number[])
                : [];
              setAdhkarSearch("");
              if (customIds.length > 0) {
                setWirdMode("custom");
                setCustomAdhkarIds(customIds);
                setSelectedWirdTemplate(null);
                loadAllAdhkar();
              } else {
                setWirdMode("template");
                setSelectedWirdTemplate(k.wird_template_id || null);
                setCustomAdhkarIds([]);
              }
            }}
            onToggleSeasonalWird={handleToggleSeasonalWird}
            onManageCustomItems={(kid: any) => {
              setNewKidCustomAr("");
              setNewKidCustomEn("");
              setCustomSeasonalKid(kid);
            }}
            onRemove={handleRemoveKid}
            wirdEnabled={flags.wird}
            voiceProfiles={voiceProfiles}
            onUpdateVoiceProfile={handleUpdateVoiceProfile}
          />
        ))}

        {/* Add Kid */}
        <Pressable
          style={[styles.addKidDashed, !canAddKid && { opacity: 0.5 }]}
          onPress={() => {
            if (!canAddKid) {
              showToast(
                isRTL
                  ? `وصلت للحد الأقصى (${maxKids} أطفال). يرجى ترقية خطتك.`
                  : `Kid limit reached (${maxKids}). Please upgrade your plan.`,
                "error",
              );
              return;
            }
            setShowAddKid(true);
            setNewKidName("");
            setNewKidAge("");
            setNewKidAvatar("🦁");
          }}
        >
          <Text style={{ fontSize: 28 }}>➕</Text>
          <Text style={styles.addKidDashedText}>
            {canAddKid
              ? t.addKidBtn
              : isRTL
                ? `الحد الأقصى ${maxKids} أطفال`
                : `Limit: ${maxKids} kids`}
          </Text>
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ━━━ HEADER ━━━
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 8,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
    position: "relative",
  },
  headerWatermark: {
    position: "absolute",
    fontSize: 130,
    opacity: 0.07,
    right: -10,
    top: 10,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  appName: { fontSize: 22, fontWeight: "900", color: "#fff" },
  appSub: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  // Kid Pills
  kidPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  kidPillActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
  },
  kidPillName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  kidPillNameActive: {
    fontSize: 14,
    fontWeight: "900",
    color: "#fff",
  },

  // OTP Banner
  otpBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: "#F59E0B",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  otpBannerIcon: { fontSize: 40 },
  otpBannerTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#92400E",
    marginBottom: 2,
  },
  otpBannerDesc: {
    fontSize: 12,
    fontWeight: "700",
    color: "#A16207",
    marginBottom: 8,
  },
  otpCodePill: {
    backgroundColor: "rgba(124,58,237,0.12)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  otpBannerCode: {
    fontSize: 28,
    fontWeight: "900",
    color: "#7C3AED",
    letterSpacing: 8,
  },
  otpBannerExpiry: { fontSize: 11, fontWeight: "700", color: "#A16207" },

  // Kid Card
  kidCard: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  kidCardWatermark: {
    position: "absolute",
    fontSize: 100,
    opacity: 0.07,
    right: -8,
    top: -8,
  },
  kidCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  kidCardAvatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  kidCardName: { fontSize: 18, fontWeight: "900", color: "#1C1917" },
  kidCardMeta: {
    fontSize: 12,
    fontWeight: "700",
    color: "#78716C",
    marginTop: 2,
  },
  kidMiniPills: { flexDirection: "row", gap: 6, marginTop: 6 },
  kidMiniPill: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  kidMiniPillText: { fontSize: 12, fontWeight: "800", color: "#1C1917" },

  // Stats
  kidStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
  },
  kidStatBox: { alignItems: "center", gap: 2 },
  kidStatNum: { fontSize: 18, fontWeight: "900" },
  kidStatLabel: { fontSize: 10, fontWeight: "700", color: "#78716C" },

  // Wird bar
  kidWirdBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  kidWirdBarOuter: {
    flex: 1,
    height: 10,
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 50,
    overflow: "hidden",
  },
  kidWirdBarFill: { height: "100%", borderRadius: 50 },
  kidWirdBarPct: {
    fontSize: 12,
    fontWeight: "800",
    color: "#059669",
    minWidth: 36,
    textAlign: "right",
  },

  // Actions
  kidCardActions: { flexDirection: "row", gap: 8, marginBottom: 8 },
  pinBtn: {
    flex: 1,
    backgroundColor: "rgba(124,58,237,0.12)",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.2)",
  },
  pinBtnText: { fontSize: 12, fontWeight: "800", color: "#7C3AED" },
  wirdBtn: {
    flex: 1,
    backgroundColor: "rgba(124,58,237,0.12)",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.2)",
  },
  wirdBtnText: { fontSize: 12, fontWeight: "800", color: "#fff" },

  // Seasonal Wird Toggle
  seasonalToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(124,58,237,0.12)",
    direction: "ltr",
  },
  seasonalToggleLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#5B21B6",
    flex: 1,
  },
  seasonalToggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#D1D5DB",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  seasonalToggleTrackOn: {
    backgroundColor: "#7C3AED",
  },
  seasonalToggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  seasonalToggleThumbOn: {
    transform: [{ translateX: 20 }],
  },

  removeKidBtn: {
    marginTop: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.07)",
  },
  removeKidText: { fontSize: 12, fontWeight: "700", color: "#EF4444" },

  // Add Kid
  addKidDashed: {
    paddingVertical: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#F97316",
    borderRadius: 24,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(249,115,22,0.06)",
  },
  addKidDashedText: { fontSize: 15, fontWeight: "800", color: "#F97316" },

  // Modal / Sheet
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 36,
    maxHeight: "85%",
  },
  sheetHandle: {
    width: 44,
    height: 5,
    backgroundColor: "#E5E7EB",
    borderRadius: 50,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1C1917",
    textAlign: "center",
  },
  sheetSub: {
    fontSize: 14,
    fontWeight: "700",
    color: "#78716C",
    textAlign: "center",
    marginTop: 4,
  },
  sheetHint: {
    fontSize: 12,
    fontWeight: "600",
    color: "#A8A29E",
    textAlign: "center",
    marginTop: 2,
  },
  sheetButtons: { flexDirection: "row", gap: 10, marginTop: 20 },

  // Form
  label: { fontSize: 13, fontWeight: "800", color: "#1C1917", marginBottom: 8 },
  input: {
    width: "100%",
    padding: 14,
    borderWidth: 2,
    borderColor: "#EDE9FE",
    borderRadius: 16,
    fontSize: 15,
    color: "#1C1917",
    backgroundColor: "#FAFAF9",
    fontWeight: "700",
  },
  pinInput: { textAlign: "center", letterSpacing: 14, fontSize: 24 },

  pinDotsWrap: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    marginBottom: 4,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#DDD6FE",
    backgroundColor: "#F9FAFB",
  },
  pinDotFilled: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },

  ageRow: { flexDirection: "row", gap: 8 },
  ageBtn: {
    width: "100%",
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    alignItems: "center",
    backgroundColor: "#FAFAF9",
  },
  ageBtnActive: {
    width: "100%",
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
  },
  ageBtnText: { fontSize: 13, fontWeight: "800", color: "#1C1917" },
  ageBtnTextActive: { fontSize: 13, fontWeight: "800", color: "#fff" },

  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  avatarBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    backgroundColor: "#FAFAF9",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBtnActive: { borderColor: "#7C3AED", backgroundColor: "#EDE9FE" },

  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "700", color: "#78716C" },
  saveBtn: { paddingVertical: 14, borderRadius: 16, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  fullSaveBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
  },

  // Wird modal
  wirdModeToggle: {
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
    marginBottom: 4,
  },
  wirdModeActive: {
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
  },
  wirdModeActiveText: { fontSize: 13, fontWeight: "800", color: "#fff" },
  wirdModeInactive: {
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  wirdModeInactiveText: { fontSize: 13, fontWeight: "700", color: "#78716C" },

  catRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FAFAF9",
    borderWidth: 2,
    borderColor: "#F3F4F6",
    borderRadius: 16,
    marginBottom: 8,
  },
  catRowActive: { backgroundColor: "#EDE9FE", borderColor: "#7C3AED" },
  catName: { fontSize: 14, fontWeight: "700", color: "#1C1917" },
  agePill: {
    backgroundColor: "#FEF3C7",
    borderRadius: 50,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  agePillText: { fontSize: 10, fontWeight: "800", color: "#92400E" },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { borderWidth: 0, backgroundColor: "#7C3AED" },

  emptyState: { alignItems: "center", paddingVertical: 20, gap: 8 },
  emptyStateText: { fontSize: 14, fontWeight: "700", color: "#A8A29E" },

  // Custom seasonal items
  customSeasonalBtn: {
    marginTop: 8,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: "rgba(124,58,237,0.3)",
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(124,58,237,0.06)",
  },
  customSeasonalBtnText: { fontSize: 12, fontWeight: "700", color: "#7C3AED" },
  customItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FAFAF9",
    borderWidth: 1.5,
    borderColor: "#EDE9FE",
    borderRadius: 14,
    marginBottom: 8,
    gap: 10,
  },
  customItemTextAr: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1C1917",
    textAlign: "right",
  },
  customItemTextEn: { fontSize: 11, fontWeight: "600", color: "#78716C" },
  customItemRemoveBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  customItemForm: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },

  // QR
  qrBtn: {
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "rgba(16,185,129,0.35)",
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "rgba(16,185,129,0.08)",
    marginBottom: 8,
  },
  qrBtnText: { fontSize: 12, fontWeight: "800", color: "#059669" },
  qrSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 36,
    alignItems: "center",
  },
  qrCodeWrap: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 232,
    minWidth: 232,
    borderWidth: 2,
    borderColor: "#EDE9FE",
  },
  qrTimerWrap: { alignItems: "center", gap: 2, marginBottom: 12 },
  qrCountdown: {
    fontSize: 28,
    fontWeight: "900",
    color: "#10B981",
    fontVariant: ["tabular-nums"],
  },
  qrCountdownWarning: { color: "#F97316" },
  qrTimerLabel: { fontSize: 11, fontWeight: "700", color: "#A8A29E" },
  qrRegenerateBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
  },
  qrRegenerateBtnText: { fontSize: 13, fontWeight: "800", color: "#7C3AED" },
});
