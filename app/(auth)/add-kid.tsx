import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useRef, useEffect } from "react";
import { authService } from "@/services/auth";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { supabase } from "@/services/supabase";
import { LinearGradient } from "expo-linear-gradient";
import { useToast } from "@/hooks/useToast";
import { Toast } from "@/components/ui";

/* ── Warm dawn tokens (from ParentRegisterScreen) ─────────── */
const C = {
  amber: "#D97706",
  amberLight: "#F59E0B",
  amberSoft: "#FEF3C7",
  amberGlow: "rgba(217,119,6,0.12)",
  amberBorder: "rgba(217,119,6,0.22)",
  teal: "#0D9488",
  tealSoft: "#F0FDFA",
  violet: "#7C3AED",
  violetSoft: "rgba(124,58,237,0.10)",
  ink: "#1C1017",
  inkMid: "#44403C",
  inkFaint: "#78716C",
  cream: "#FFFBF5",
  creamWarm: "#FFF7ED",
  white: "#FFFFFF",
  border: "rgba(217,119,6,0.14)",
};

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
const AGE_GROUPS = [
  { value: "4-6", labelAr: "٤-٦", labelEn: "4-6" },
  { value: "7-9", labelAr: "٧-٩", labelEn: "7-9" },
  { value: "10-12", labelAr: "١٠-١٢", labelEn: "10-12" },
];

/* ── Section header ──────────────────────────────────────────── */
function SectionHead({ label, isRTL }: { label: string; isRTL: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 10,
        alignSelf: "stretch",
      }}
    >
      <View
        style={{
          width: 3.5,
          height: 15,
          borderRadius: 2,
          backgroundColor: C.amber,
        }}
      />
      <Text
        style={{
          fontSize: 12,
          fontWeight: "800",
          color: C.inkMid,
          textTransform: "uppercase",
          letterSpacing: 0.3,
          ...(isRTL ? { textAlign: "right" } : {}),
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/* ── PIN dot display ─────────────────────────────────────────── */
function PinDots({ value, length = 4 }: { value: string; length?: number }) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 10,
        justifyContent: "center",
        marginVertical: 8,
      }}
    >
      {Array.from({ length }).map((_, i) => {
        const filled = i < value.length;
        return (
          <View
            key={i}
            style={[
              A.pinDot,
              {
                backgroundColor: filled ? C.amber : "transparent",
                borderColor: filled ? C.amber : C.amberBorder,
                shadowColor: filled ? C.amber : "transparent",
                shadowOpacity: filled ? 0.5 : 0,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
                elevation: filled ? 3 : 0,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export default function AddKidScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [avatar, setAvatar] = useState("🦁");
  const [pin, setPin] = useState("");
  const [pinFocused, setPinFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const { family, user, refreshKids, refreshFamily } = useAuth();
  const { lang } = useLang();
  const isRTL = lang === "ar";
  const { toast, showToast } = useToast();

  useEffect(() => {
    if (!family) refreshFamily();
  }, []);

  /* Preview pulse */
  const previewAnim = useRef(new Animated.Value(0.85)).current;
  useEffect(() => {
    if (avatar && name)
      Animated.spring(previewAnim, {
        toValue: 1,
        tension: 180,
        friction: 11,
        useNativeDriver: true,
      }).start();
  }, [avatar, name]);

  const handleAdd = async () => {
    if (!name || !ageGroup) {
      showToast(
        isRTL
          ? "يرجى إدخال الاسم واختيار الفئة العمرية"
          : "Please enter name and select age group",
        "error",
      );
      return;
    }
    let familyId = family?.id;
    if (!familyId && user?.id) {
      try {
        const { data } = await supabase
          .from("families")
          .select("id")
          .eq("auth_user_id", user.id)
          .single();
        familyId = data?.id;
      } catch {}
    }
    if (!familyId) {
      showToast(
        isRTL
          ? "حدث خطأ، حاول مجدداً"
          : "Something went wrong, please try again",
        "error",
      );
      return;
    }
    setLoading(true);
    try {
      await authService.addKid(
        familyId,
        name,
        ageGroup,
        avatar,
        pin || undefined,
      );
      await refreshKids();
      if (from === "parent") router.back();
      else router.replace("/(auth)/referral");
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#FFFBF5", "#FEF3C7", "#FDF4E7"]}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      <Toast toast={toast} />

      {/* Ambient blobs */}
      <View
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: C.amberGlow,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 60,
          left: -60,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: "rgba(13,148,136,0.06)",
        }}
      />

      <ScrollView
        contentContainerStyle={A.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        {from === "parent" && (
          <Pressable
            style={({ pressed }) => [
              A.backBtn,
              pressed && { opacity: 0.65, transform: [{ scale: 0.92 }] },
            ]}
            onPress={() => router.back()}
          >
            <Text style={A.backBtnText}>{isRTL ? "→" : "←"}</Text>
          </Pressable>
        )}

        {/* Page header */}
        <View style={A.header}>
          <View style={A.headerBadge}>
            <LinearGradient
              colors={["#FEF3C7", "#FDE68A"]}
              style={A.headerBadgeInner}
            >
              <Text style={{ fontSize: 38 }}>👶</Text>
            </LinearGradient>
          </View>
          <Text style={A.title}>{isRTL ? "إضافة طفل" : "Add a Child"}</Text>
          <Text style={A.subtitle}>
            {isRTL
              ? "اختر شخصية واسم لطفلك"
              : "Pick an avatar and name for your child"}
          </Text>
        </View>

        {/* ── Avatar card ── */}
        <View style={A.card}>
          <View style={A.cardAccent} />
          <SectionHead
            label={isRTL ? "اختر الشخصية" : "Pick Avatar"}
            isRTL={isRTL}
          />
          <View style={A.avatarGrid}>
            {AVATARS.map((a) => {
              const selected = avatar === a;
              return (
                <Pressable key={a} onPress={() => setAvatar(a)}>
                  <View style={[A.avatarBtn, selected && A.avatarSelected]}>
                    <Text style={A.avatarEmoji}>{a}</Text>
                    {selected && <View style={A.avatarDot} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Info card ── */}
        <View style={A.card}>
          <View style={[A.cardAccent, { backgroundColor: C.teal }]} />

          <SectionHead
            label={isRTL ? "اسم الطفل" : "Child's Name"}
            isRTL={isRTL}
          />
          <View style={[A.fieldWrap, { marginBottom: 18 }]}>
            <TextInput
              style={[A.fieldInput, isRTL && { textAlign: "right" }]}
              value={name}
              onChangeText={setName}
              placeholder={isRTL ? "اكتب الاسم..." : "Type name..."}
              placeholderTextColor="#C4A98A"
              maxLength={20}
            />
          </View>

          <SectionHead
            label={isRTL ? "الفئة العمرية" : "Age Group"}
            isRTL={isRTL}
          />
          <View style={A.ageRow}>
            {AGE_GROUPS.map((ag) => {
              const selected = ageGroup === ag.value;
              return (
                <Pressable
                  key={ag.value}
                  style={{ flex: 1 }}
                  onPress={() => setAgeGroup(ag.value)}
                >
                  <View style={[A.ageBtn, selected && A.ageBtnSelected]}>
                    {selected && (
                      <LinearGradient
                        colors={[C.amber, C.amberLight]}
                        style={StyleSheet.absoluteFillObject}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                    )}
                    <Text
                      style={[A.ageBtnText, selected && A.ageBtnTextSelected]}
                    >
                      {isRTL ? ag.labelAr : ag.labelEn}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── PIN card ── */}
        <View style={A.card}>
          <View style={[A.cardAccent, { backgroundColor: C.violet }]} />
          <SectionHead label={isRTL ? "رمز PIN " : "PIN Code"} isRTL={isRTL} />
          <Text style={A.hint}>
            {isRTL
              ? "سيستخدمه طفلك لدخول التطبيق"
              : "Your child will use this to log in"}
          </Text>

          <View
            style={[
              A.fieldWrap,
              { borderColor: pinFocused ? C.amber : C.border },
            ]}
          >
            <TextInput
              style={[
                A.fieldInput,
                { textAlign: "center", letterSpacing: 8, fontSize: 18 },
              ]}
              value={pin}
              onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 4))}
              placeholder="• • • •"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              placeholderTextColor="#C4A98A"
              onFocus={() => setPinFocused(true)}
              onBlur={() => setPinFocused(false)}
            />
          </View>
        </View>

        {/* ── Live preview ── */}
        {avatar && name ? (
          <Animated.View
            style={[A.preview, { transform: [{ scale: previewAnim }] }]}
          >
            <LinearGradient
              colors={[C.creamWarm, C.amberSoft]}
              style={A.previewGrad}
            >
              <View style={A.previewAvatarWrap}>
                <Text style={{ fontSize: 44 }}>{avatar}</Text>
              </View>
              <View>
                <Text style={A.previewName}>{name}</Text>
                {ageGroup && (
                  <View style={A.previewAgePill}>
                    <Text style={A.previewAgeText}>
                      🎂 {ageGroup} {isRTL ? "سنوات" : "years"}
                    </Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </Animated.View>
        ) : null}

        {/* CTA */}
        <Pressable
          onPress={handleAdd}
          disabled={loading}
          style={({ pressed }) => [
            A.ctaWrap,
            (loading || pressed) && {
              opacity: 0.75,
              transform: [{ scale: 0.98 }],
            },
          ]}
        >
          <LinearGradient
            colors={[C.amber, "#B45309"]}
            style={A.ctaBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={A.btnGloss} />
            <Text style={A.ctaText}>
              {loading
                ? isRTL
                  ? "⏳ جارٍ الإضافة..."
                  : "⏳ Adding..."
                : isRTL
                  ? "✅ إضافة الطفل"
                  : "✅ Add Child"}
            </Text>
          </LinearGradient>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const A = StyleSheet.create({
  scroll: { padding: 22, paddingTop: 60 },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(217,119,6,0.10)",
    borderWidth: 1.5,
    borderColor: "rgba(217,119,6,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  backBtnText: { fontSize: 20, fontWeight: "900", color: C.amber },

  header: { alignItems: "center", marginBottom: 22 },
  headerBadge: {
    width: 78,
    height: 78,
    borderRadius: 39,
    overflow: "hidden",
    borderWidth: 2.5,
    borderColor: "rgba(217,119,6,0.22)",
    marginBottom: 12,
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },
  headerBadgeInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1C1017",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#78716C",
    textAlign: "center",
  },

  /* Card */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(217,119,6,0.07)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
    overflow: "hidden",
  },
  cardAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: C.amber,
  },

  /* Avatar grid */
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginTop: 4,
  },
  avatarBtn: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(217,119,6,0.12)",
    position: "relative",
  },
  avatarSelected: {
    borderColor: C.amber,
    backgroundColor: "#FEF3C7",
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarEmoji: { fontSize: 28 },
  avatarDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.amber,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },

  /* Field */
  hint: { fontSize: 12, fontWeight: "600", color: "#A8A29E", marginBottom: 10 },
  fieldWrap: {
    backgroundColor: "#FFF7ED",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(217,119,6,0.14)",
    overflow: "hidden",
  },
  fieldInput: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#1C1017",
    fontSize: 15,
    fontWeight: "700",
  },

  /* PIN dot */
  pinDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2.5 },

  /* Age buttons */
  ageRow: { flexDirection: "row", gap: 8 },
  ageBtn: {
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(217,119,6,0.12)",
    backgroundColor: "#FFF7ED",
    overflow: "hidden",
    position: "relative",
  },
  ageBtnSelected: {
    borderColor: "transparent",
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  ageBtnText: { fontSize: 16, fontWeight: "800", color: "#A8A29E" },
  ageBtnTextSelected: { color: "#FFFFFF" },

  /* Preview */
  preview: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: "rgba(217,119,6,0.14)",
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  previewGrad: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 14,
  },
  previewAvatarWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "rgba(255,255,255,0.7)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(217,119,6,0.18)",
  },
  previewName: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1C1017",
    marginBottom: 5,
  },
  previewAgePill: {
    backgroundColor: "rgba(217,119,6,0.10)",
    borderWidth: 1.5,
    borderColor: "rgba(217,119,6,0.20)",
    borderRadius: 50,
    paddingVertical: 3,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
  },
  previewAgeText: { fontSize: 11, fontWeight: "800", color: C.amber },

  /* CTA */
  ctaWrap: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaBtn: {
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: "center",
    overflow: "hidden",
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  btnGloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});
