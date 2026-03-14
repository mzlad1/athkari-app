import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  StyleSheet,
  Modal,
  TextInput,
} from "react-native";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "@/constants/theme";
import { T } from "@/constants/translations";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { supabase } from "@/services/supabase";
import { LinearGradient } from "expo-linear-gradient";
import { useToast } from "@/hooks/useToast";
import { Toast, ConfirmModal } from "@/components/ui";
import type { ConfirmConfig } from "@/components/ui";

export default function SettingsScreen() {
  const { user, family, kids, logout, refreshFamily } = useAuth();
  const { lang, toggleLang } = useLang();
  const isRTL = lang === "ar";
  const t = T[lang];

  const { toast, showToast } = useToast();
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editNameVal, setEditNameVal] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [changingPass, setChangingPass] = useState(false);
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [savingPass, setSavingPass] = useState(false);

  const [dailyReport, setDailyReport] = useState(true);
  const [weeklyEmail, setWeeklyEmail] = useState(true);
  const [streakAlert, setStreakAlert] = useState(false);
  const [wirdReminder, setWirdReminder] = useState(true);

  const [selectedKidIdx, setSelectedKidIdx] = useState(0);
  const [allowFriends, setAllowFriends] = useState(true);
  const [allowChat, setAllowChat] = useState(false);
  const [allowKidAcceptChallenge, setAllowKidAcceptChallenge] = useState(true);

  const currentKidId = kids[selectedKidIdx]?.id;

  useEffect(() => {
    if (!currentKidId) return;
    AsyncStorage.getItem(`allow_friends_${currentKidId}`).then((val) => {
      setAllowFriends(val !== null ? val === "true" : true);
    });
    AsyncStorage.getItem(`allow_chat_${currentKidId}`).then((val) => {
      setAllowChat(val !== null ? val === "true" : false);
    });
    AsyncStorage.getItem(`allow_kid_accept_challenge_${currentKidId}`).then(
      (val) => {
        setAllowKidAcceptChallenge(val !== null ? val === "true" : true);
      },
    );
  }, [currentKidId]);

  const toggleAllowFriends = async (val: boolean) => {
    setAllowFriends(val);
    if (currentKidId)
      await AsyncStorage.setItem(`allow_friends_${currentKidId}`, String(val));
  };
  const toggleAllowChat = async (val: boolean) => {
    setAllowChat(val);
    if (currentKidId)
      await AsyncStorage.setItem(`allow_chat_${currentKidId}`, String(val));
  };
  const toggleAllowKidAcceptChallenge = async (val: boolean) => {
    setAllowKidAcceptChallenge(val);
    if (currentKidId)
      await AsyncStorage.setItem(
        `allow_kid_accept_challenge_${currentKidId}`,
        String(val),
      );
  };

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(isRTL ? "ar" : "en", {
        year: "numeric",
        month: "long",
      })
    : "—";

  const handleChangePassword = async () => {
    const email = user?.email;
    if (!email) return;

    if (newPass.length < 6) {
      showToast(t.passwordTooShort, "error");
      return;
    }
    if (newPass !== confirmPass) {
      showToast(t.passwordsNotMatch, "error");
      return;
    }

    setSavingPass(true);
    try {
      // Verify old password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: oldPass,
      });
      if (signInError) {
        showToast(t.wrongOldPassword, "error");
        setSavingPass(false);
        return;
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPass,
      });
      if (updateError) throw updateError;

      showToast(t.passwordChanged);
      setChangingPass(false);
      setOldPass("");
      setNewPass("");
      setConfirmPass("");
    } catch {
      showToast(isRTL ? "حدث خطأ" : "Something went wrong", "error");
    } finally {
      setSavingPass(false);
    }
  };

  const handleSaveParentName = async () => {
    if (!editNameVal.trim() || !family?.id) return;
    setSavingName(true);
    try {
      const { error } = await supabase
        .from("families")
        .update({ parent_name: editNameVal.trim() })
        .eq("id", family.id);
      if (error) throw error;
      await refreshFamily();
      setEditingName(false);
      showToast(isRTL ? " تم تحديث الاسم" : "Name updated");
    } catch {
      showToast(isRTL ? "فشل التحديث" : "Failed to update", "error");
    } finally {
      setSavingName(false);
    }
  };

  const handleLogout = () => {
    setConfirm({
      title: isRTL ? "تسجيل الخروج" : "Logout",
      message: isRTL ? "هل أنت متأكد؟" : "Are you sure?",
      confirmText: isRTL ? "خروج" : "Logout",
      cancelText: t.cancel,
      destructive: true,
      onConfirm: () => logout(),
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FFF7ED" }}>
      <Toast toast={toast} />
      <ConfirmModal config={confirm} onClose={() => setConfirm(null)} />

      {/* ━━━ EDIT NAME MODAL ━━━ */}
      <Modal visible={editingName} transparent animationType="slide">
        <Pressable
          style={settingsModalOverlay}
          onPress={() => setEditingName(false)}
        >
          <Pressable style={settingsModalSheet} onPress={() => {}}>
            <View style={settingsModalHandle} />
            <Text style={settingsModalTitle}>
              🏷️ {isRTL ? "تعديل الاسم" : "Edit Name"}
            </Text>
            <TextInput
              style={settingsModalInput}
              value={editNameVal}
              onChangeText={setEditNameVal}
              placeholder={isRTL ? "اسمك" : "Your name"}
              placeholderTextColor="#A78BFA"
              autoFocus
            />
            <View style={settingsModalBtns}>
              <Pressable
                style={settingsModalCancel}
                onPress={() => setEditingName(false)}
              >
                <Text style={{ fontWeight: "800", color: "#78716C" }}>
                  ❌ {isRTL ? "إلغاء" : "Cancel"}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  settingsModalSave,
                  (!editNameVal.trim() || savingName) && { opacity: 0.4 },
                ]}
                onPress={handleSaveParentName}
                disabled={!editNameVal.trim() || savingName}
              >
                <LinearGradient
                  colors={["#F97316", "#FB923C"]}
                  style={settingsModalSaveGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text
                    style={{ fontWeight: "900", color: "#fff", fontSize: 14 }}
                  >
                    {savingName ? "⏳" : `✅ ${isRTL ? "حفظ" : "Save"}`}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ━━━ CHANGE PASSWORD MODAL ━━━ */}
      <Modal visible={changingPass} transparent animationType="slide">
        <Pressable
          style={settingsModalOverlay}
          onPress={() => setChangingPass(false)}
        >
          <Toast toast={toast} />
          <Pressable style={settingsModalSheet} onPress={() => {}}>
            <View style={settingsModalHandle} />
            <Text style={settingsModalTitle}>
              🔑 {isRTL ? "تغيير كلمة المرور" : "Change Password"}
            </Text>
            <TextInput
              style={settingsModalInput}
              value={oldPass}
              onChangeText={setOldPass}
              placeholder={t.oldPassword}
              placeholderTextColor="#A78BFA"
              secureTextEntry
              autoFocus
            />
            <TextInput
              style={settingsModalInput}
              value={newPass}
              onChangeText={setNewPass}
              placeholder={t.newPassword}
              placeholderTextColor="#A78BFA"
              secureTextEntry
            />
            <TextInput
              style={settingsModalInput}
              value={confirmPass}
              onChangeText={setConfirmPass}
              placeholder={t.confirmNewPassword}
              placeholderTextColor="#A78BFA"
              secureTextEntry
            />
            <View style={settingsModalBtns}>
              <Pressable
                style={settingsModalCancel}
                onPress={() => {
                  setChangingPass(false);
                  setOldPass("");
                  setNewPass("");
                  setConfirmPass("");
                }}
              >
                <Text style={{ fontWeight: "800", color: "#78716C" }}>
                  ❌ {isRTL ? "إلغاء" : "Cancel"}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  settingsModalSave,
                  (!oldPass || !newPass || !confirmPass || savingPass) && {
                    opacity: 0.4,
                  },
                ]}
                onPress={handleChangePassword}
                disabled={!oldPass || !newPass || !confirmPass || savingPass}
              >
                <LinearGradient
                  colors={["#F97316", "#FB923C"]}
                  style={settingsModalSaveGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text
                    style={{ fontWeight: "900", color: "#fff", fontSize: 14 }}
                  >
                    {savingPass ? "⏳" : `✅ ${isRTL ? "تغيير" : "Change"}`}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ━━━ HERO HEADER ━━━ */}
      <LinearGradient
        colors={["#F97316", "#FB923C"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerWatermark}>⚙️</Text>

        {/* Profile row */}
        <View style={styles.profileRow}>
          <View style={styles.profileAvatar}>
            <Text style={{ fontSize: 30 }}>👨‍👩‍👧</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>
              {family?.parent_name || (isRTL ? "ولي الأمر" : "Parent")}
            </Text>
            <Text style={styles.profileEmail}>{user?.email || "—"}</Text>
          </View>
          <Pressable style={styles.langPill} onPress={toggleLang}>
            <Text style={styles.langPillText}>🌍 {t.lang}</Text>
          </Pressable>
        </View>

        {/* Quick stat pills */}
        {/* <View style={styles.headerStatRow}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatNum}>{kids.length}</Text>
            <Text style={styles.headerStatLabel}>
              {isRTL ? "أطفال" : "Kids"}
            </Text>
          </View>
          <View
            style={[
              styles.headerStat,
              { backgroundColor: "rgba(249,115,22,0.25)" },
            ]}
          >
            <Text style={styles.headerStatNum}>{joinedDate}</Text>
            <Text style={styles.headerStatLabel}>
              {isRTL ? "تاريخ التسجيل" : "Joined"}
            </Text>
          </View>
        </View> */}
      </LinearGradient>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ━━━ PROFILE DETAILS ━━━ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.parentProfile}</Text>
          <InfoRow emoji="📧" label={t.email} value={user?.email || "—"} />
          <InfoRow emoji="📅" label={t.joined} value={joinedDate} />
          <InfoRow emoji="👶" label={t.children} value={String(kids.length)} />
          <Pressable
            style={[styles.infoRow, { borderBottomWidth: 0 }]}
            onPress={() => {
              setEditNameVal(family?.parent_name || "");
              setEditingName(true);
            }}
          >
            <View style={styles.infoIconBubble}>
              <Text style={{ fontSize: 16 }}>🏷️</Text>
            </View>
            <Text style={styles.infoLabel}>{isRTL ? "الاسم" : "Name"}</Text>
            <Text style={[styles.infoValue, { flex: 1 }]} numberOfLines={1}>
              {family?.parent_name || "—"}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: "#F97316",
                fontWeight: "800",
                marginLeft: 8,
              }}
            >
              ✏️
            </Text>
          </Pressable>
        </View>

        {/* ━━━ SOCIAL CONTROLS ━━━ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            👥 {isRTL ? "التحكم الاجتماعي" : "Social Controls"}
          </Text>

          {/* Kid selector */}
          {kids.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 14, direction: "ltr" }}
              contentContainerStyle={{ gap: 8 }}
            >
              {kids.map((kid: any, i: number) => (
                <Pressable key={kid.id} onPress={() => setSelectedKidIdx(i)}>
                  {selectedKidIdx === i ? (
                    <LinearGradient
                      colors={["#F97316", "#FB923C"]}
                      style={styles.kidPillActive}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Text style={{ fontSize: 16 }}>{kid.avatar || "👦"}</Text>
                      <Text style={styles.kidPillNameActive}>{kid.name}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.kidPill}>
                      <Text style={{ fontSize: 16 }}>{kid.avatar || "👦"}</Text>
                      <Text style={styles.kidPillName}>{kid.name}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}

          {kids.length === 1 && (
            <View style={styles.singleKidBadge}>
              <Text style={{ fontSize: 18 }}>{kids[0].avatar || "👦"}</Text>
              <Text style={styles.singleKidName}>{kids[0].name}</Text>
            </View>
          )}

          <ToggleRow
            emoji="👫"
            label={t.allowFriends}
            value={allowFriends}
            onToggle={toggleAllowFriends}
          />
          <ToggleRow
            emoji="💬"
            label={t.allowChat}
            value={allowChat}
            onToggle={toggleAllowChat}
          />
          <ToggleRow
            emoji="🎯"
            label={t.allowKidAcceptChallenge}
            value={allowKidAcceptChallenge}
            onToggle={toggleAllowKidAcceptChallenge}
            last
          />
        </View>

        {/* ━━━ SECURITY ━━━ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.security}</Text>
          <Pressable
            style={styles.actionRow}
            onPress={() => setChangingPass(true)}
          >
            <View style={styles.actionIconBubble}>
              <Text style={{ fontSize: 16 }}>🔑</Text>
            </View>
            <Text style={styles.actionLabel}>{t.changePass}</Text>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>
        </View>

        {/* ━━━ SUPPORT ━━━ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.supportSection}</Text>
          {[
            { label: t.helpCenter, emoji: "❓" },
            { label: t.contactUs, emoji: "📩" },
            { label: t.rateApp, emoji: "⭐" },
          ].map((item, i, arr) => (
            <Pressable
              key={i}
              style={[
                styles.actionRow,
                i === arr.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={styles.actionIconBubble}>
                <Text style={{ fontSize: 16 }}>{item.emoji}</Text>
              </View>
              <Text style={styles.actionLabel}>{item.label}</Text>
              <Text style={styles.actionArrow}>›</Text>
            </Pressable>
          ))}
        </View>

        {/* ━━━ LOGOUT ━━━ */}
        <Pressable onPress={handleLogout}>
          <LinearGradient
            colors={["#EF4444", "#DC2626"]}
            style={styles.logoutBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.logoutText}>
              🚪 {isRTL ? "تسجيل الخروج" : "Logout"}
            </Text>
          </LinearGradient>
        </Pressable>

        {/* App version */}
        <Text style={styles.versionText}>
          v1.0.0 • {isRTL ? "مصنوع بـ ❤️" : "Made with ❤️"}
        </Text>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

/* ─── Helper Components ─── */

function InfoRow({
  emoji,
  label,
  value,
  last,
}: {
  emoji: string;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <View style={styles.infoIconBubble}>
        <Text style={{ fontSize: 16 }}>{emoji}</Text>
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ToggleRow({
  emoji,
  label,
  value,
  onToggle,
  last,
}: {
  emoji: string;
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, last && { borderBottomWidth: 0 }]}>
      <View
        style={[
          styles.infoIconBubble,
          value
            ? { backgroundColor: "#EDE9FE" }
            : { backgroundColor: "#F3F4F6" },
        ]}
      >
        <Text style={{ fontSize: 16 }}>{emoji}</Text>
      </View>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "#E5E7EB", true: "#A78BFA" }}
        thumbColor={value ? "#7C3AED" : "#fff"}
      />
    </View>
  );
}

/* ── Edit Name modal plain styles (used inside component JSX) ── */
const settingsModalOverlay = {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.45)",
  justifyContent: "flex-end" as const,
};
const settingsModalSheet = {
  backgroundColor: "#fff",
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
  padding: 24,
  paddingBottom: 40,
  gap: 14,
};
const settingsModalHandle = {
  width: 40,
  height: 4,
  borderRadius: 2,
  backgroundColor: "#E5E7EB",
  alignSelf: "center" as const,
  marginBottom: 8,
};
const settingsModalTitle = {
  fontSize: 18,
  fontWeight: "900" as const,
  color: "#1C1917",
  textAlign: "center" as const,
};
const settingsModalInput = {
  backgroundColor: "#F9F5FF",
  borderWidth: 1.5,
  borderColor: "#DDD6FE",
  borderRadius: 16,
  paddingHorizontal: 16,
  paddingVertical: 12,
  fontSize: 16,
  color: "#1C1917",
};
const settingsModalBtns = {
  flexDirection: "row" as const,
  gap: 10,
  marginTop: 4,
};
const settingsModalCancel = {
  flex: 1,
  backgroundColor: "#F3F4F6",
  borderRadius: 16,
  paddingVertical: 13,
  alignItems: "center" as const,
};
const settingsModalSave = {
  flex: 1,
  borderRadius: 16,
  overflow: "hidden" as const,
};
const settingsModalSaveGrad = {
  paddingVertical: 13,
  alignItems: "center" as const,
};

const styles = StyleSheet.create({
  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 18,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
    position: "relative",
  },
  headerWatermark: {
    position: "absolute",
    fontSize: 130,
    opacity: 0.2,
    right: -10,
    top: 10,
  },

  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: { fontSize: 17, fontWeight: "900", color: "#fff" },
  profileEmail: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  langPill: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  langPillText: { fontSize: 12, fontWeight: "800", color: "#fff" },

  headerStatRow: { flexDirection: "row", gap: 10 },
  headerStat: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  headerStatNum: { fontSize: 14, fontWeight: "900", color: "#fff" },
  headerStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    marginTop: 1,
  },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1C1917",
    marginBottom: 14,
  },

  // Info Row
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#FEF3C7",
  },
  infoIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: { fontSize: 13, fontWeight: "700", color: "#78716C", flex: 1 },
  infoValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1C1917",
    maxWidth: 160,
    textAlign: "right",
  },

  // Toggle Row
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#FEF3C7",
  },
  toggleLabel: { flex: 1, fontSize: 14, fontWeight: "700", color: "#1C1917" },

  // Kid Selector
  kidPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: "#F3F4F6",
  },
  kidPillActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
  },
  kidPillName: { fontSize: 13, fontWeight: "700", color: "#78716C" },
  kidPillNameActive: { fontSize: 13, fontWeight: "900", color: "#fff" },
  singleKidBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 16,
    padding: 10,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  singleKidName: { fontSize: 14, fontWeight: "800", color: "#92400E" },

  // Action Row
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#FEF3C7",
  },
  actionIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { flex: 1, fontSize: 14, fontWeight: "700", color: "#1C1917" },
  actionArrow: { fontSize: 22, color: "#A8A29E", fontWeight: "300" },

  // Logout
  logoutBtn: {
    paddingVertical: 16,
    borderRadius: 22,
    alignItems: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  logoutText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  versionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#A8A29E",
    textAlign: "center",
    marginTop: 14,
  },
});
