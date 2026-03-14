import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  StyleSheet,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { COLORS } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { subscriptionService } from "@/services/subscriptions";
import { useToast } from "@/hooks/useToast";
import { Toast, ConfirmModal } from "@/components/ui";
import type { ConfirmConfig } from "@/components/ui";

const SETTINGS_KEY = "@athkari_settings";

export default function SettingsScreen() {
  const { family, logout, activeKid } = useAuth();
  const { lang, isRTL } = useLang();

  const { toast, showToast } = useToast();
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  // Load persisted settings on mount
  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.notifications !== undefined)
            setNotificationsEnabled(parsed.notifications);
          if (parsed.sound !== undefined) setSoundEnabled(parsed.sound);
          if (parsed.haptics !== undefined) setHapticsEnabled(parsed.haptics);
        } catch {}
      }
    });
  }, []);

  // Persist whenever a toggle changes
  const updateSetting = (key: string, value: boolean) => {
    const newSettings: Record<string, boolean> = {};
    if (key === "notifications") {
      setNotificationsEnabled(value);
    } else if (key === "sound") {
      setSoundEnabled(value);
    } else if (key === "haptics") {
      setHapticsEnabled(value);
    }

    // Read current then merge
    AsyncStorage.getItem(SETTINGS_KEY).then((raw) => {
      const existing = raw ? JSON.parse(raw) : {};
      existing[key] = value;
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(existing));
    });
  };

  const handleRestore = async () => {
    try {
      await subscriptionService.restore();
      showToast(isRTL ? "تم استعادة المشتريات" : "Purchases restored");
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const handleLogout = () => {
    setConfirm({
      title: isRTL ? "تسجيل الخروج" : "Log Out",
      message: isRTL ? "هل أنت متأكد؟" : "Are you sure?",
      confirmText: isRTL ? "خروج" : "Log Out",
      cancelText: isRTL ? "إلغاء" : "Cancel",
      destructive: true,
      onConfirm: () => logout(),
    });
  };

  const SettingRow = ({
    icon,
    title,
    subtitle,
    rightComponent,
    onPress,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    rightComponent?: React.ReactNode;
    onPress?: () => void;
  }) => (
    <Pressable
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress && !rightComponent}
    >
      <View style={styles.settingLeft}>
        <Text style={styles.settingIcon}>{icon}</Text>
        <View>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightComponent || (
        <Text style={styles.settingArrow}>{isRTL ? "‹" : "›"}</Text>
      )}
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <Toast toast={toast} />
      <ConfirmModal config={confirm} onClose={() => setConfirm(null)} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>{isRTL ? "→" : "←"}</Text>
        </Pressable>

        <Text style={styles.title}>
          {isRTL ? "⚙️ الإعدادات" : "⚙️ Settings"}
        </Text>

        {/* Account */}
        <Text style={styles.sectionTitle}>{isRTL ? "الحساب" : "Account"}</Text>
        <View style={styles.section}>
          <SettingRow
            icon="👤"
            title={family?.parent_name || ""}
            subtitle={family?.parent_email || ""}
          />
          <SettingRow
            icon="💳"
            title={isRTL ? "الاشتراك" : "Subscription"}
            subtitle={
              family?.billing_status === "active"
                ? isRTL
                  ? "مفعّل"
                  : "Active"
                : family?.billing_status === "trial"
                  ? isRTL
                    ? "فترة تجريبية"
                    : "Trial"
                  : isRTL
                    ? "غير مفعّل"
                    : "Inactive"
            }
            onPress={() => router.push("/(auth)/plans")}
          />
          <SettingRow
            icon="🔄"
            title={isRTL ? "استعادة المشتريات" : "Restore Purchases"}
            onPress={handleRestore}
          />
        </View>

        {/* Preferences */}
        <Text style={styles.sectionTitle}>
          {isRTL ? "التفضيلات" : "Preferences"}
        </Text>
        <View style={styles.section}>
          <SettingRow
            icon="🔔"
            title={isRTL ? "الإشعارات" : "Notifications"}
            rightComponent={
              <Switch
                value={notificationsEnabled}
                onValueChange={(v) => updateSetting("notifications", v)}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            icon="🔊"
            title={isRTL ? "الأصوات" : "Sounds"}
            rightComponent={
              <Switch
                value={soundEnabled}
                onValueChange={(v) => updateSetting("sound", v)}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            icon="📳"
            title={isRTL ? "الاهتزاز" : "Haptics"}
            rightComponent={
              <Switch
                value={hapticsEnabled}
                onValueChange={(v) => updateSetting("haptics", v)}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* About */}
        <Text style={styles.sectionTitle}>
          {isRTL ? "حول التطبيق" : "About"}
        </Text>
        <View style={styles.section}>
          <SettingRow
            icon="📜"
            title={isRTL ? "سياسة الخصوصية" : "Privacy Policy"}
            onPress={() => Linking.openURL("https://athkari.app/privacy")}
          />
          <SettingRow
            icon="📋"
            title={isRTL ? "شروط الاستخدام" : "Terms of Use"}
            onPress={() => Linking.openURL("https://athkari.app/terms")}
          />
          <SettingRow
            icon="💌"
            title={isRTL ? "تواصل معنا" : "Contact Us"}
            onPress={() => Linking.openURL("mailto:support@athkari.app")}
          />
          <SettingRow
            icon="⭐"
            title={isRTL ? "قيّم التطبيق" : "Rate Us"}
            onPress={() => {
              // TODO: Link to App Store / Google Play
              showToast(isRTL ? "شكراً لتقييمك!" : "Thanks for rating!");
            }}
          />
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>
            {isRTL ? "تسجيل الخروج 🚪" : "Log Out 🚪"}
          </Text>
        </Pressable>

        <Text style={styles.version}>
          Athkari v3.0 • {isRTL ? "بُني بحب 💜" : "Built with love 💜"}
        </Text>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingTop: 60, paddingHorizontal: 20 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.bgCard,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  backText: { color: COLORS.text, fontSize: 20 },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },
  section: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  settingIcon: { fontSize: 22 },
  settingTitle: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  settingSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  settingArrow: { fontSize: 20, color: COLORS.textMuted },
  logoutBtn: {
    backgroundColor: COLORS.red + "15",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.red + "30",
    marginTop: 8,
  },
  logoutText: { color: COLORS.red, fontWeight: "700", fontSize: 15 },
  version: {
    textAlign: "center",
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 20,
  },
});
