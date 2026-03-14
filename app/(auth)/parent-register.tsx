import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useState, useRef, useEffect } from "react";
import { authService } from "@/services/auth";
import { useLang } from "@/contexts/LangContext";
import { LinearGradient } from "expo-linear-gradient";
import { useToast } from "@/hooks/useToast";
import { Toast } from "@/components/ui";

/* ─── Brand tokens ──────────────────────────────────────────────
   Shared with app-wide theme — extract to constants/theme.ts
   ────────────────────────────────────────────────────────────── */
const T = {
  /* Warm amber gold — main brand */
  amber: "#D97706",
  amberLight: "#FDE68A",
  amberSoft: "#FEF3C7",
  amberGlow: "rgba(217,119,6,0.14)",
  amberBorder: "rgba(217,119,6,0.22)",

  /* Teal — secondary / sign-in world */
  teal: "#0D9488",
  tealLight: "#CCFBF1",
  tealSoft: "#F0FDFA",
  tealGlow: "rgba(13,148,136,0.14)",
  tealBorder: "rgba(13,148,136,0.22)",

  /* Violet — decorative only */
  violet: "#7C3AED",
  violetSoft: "#EDE9FE",

  /* Neutrals */
  ink: "#1C1017",
  inkMid: "#44403C",
  inkFaint: "#78716C",
  cream: "#FFFBF5",
  creamWarm: "#FFF7ED",
  creamDark: "#FDF4E7",
  white: "#FFFFFF",
  border: "#F5EBD8",
  borderFocus: "#D97706",

  /* Semantic */
  error: "#DC2626",
  errorSoft: "#FEF2F2",
  success: "#059669",
  successSoft: "#ECFDF5",
};

/* ─── Decorative star pattern (SVG-style via borders) ─────────── */
const StarDecor = ({ size = 18, color = T.amber, opacity = 0.18 }) => (
  <View
    style={{
      width: size,
      height: size,
      opacity,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {/* 8-pointed star via two rotated squares */}
    <View
      style={{
        position: "absolute",
        width: size * 0.65,
        height: size * 0.65,
        backgroundColor: color,
        transform: [{ rotate: "0deg" }],
      }}
    />
    <View
      style={{
        position: "absolute",
        width: size * 0.65,
        height: size * 0.65,
        backgroundColor: color,
        transform: [{ rotate: "45deg" }],
      }}
    />
  </View>
);

/* ─── Floating dot ornament ───────────────────────────────────── */
const FloatDot = ({ style }: { style?: any }) => (
  <View
    style={[
      {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: T.amber,
        opacity: 0.35,
      },
      style,
    ]}
  />
);

/* ─── Input field with focus state ───────────────────────────── */
function FormInput({
  label,
  value,
  onChange,
  placeholder,
  keyboardType = "default",
  secureTextEntry = false,
  isRTL = false,
  mode = "register",
}: any) {
  const [focused, setFocused] = useState(false);
  const accentColor = mode === "register" ? T.amber : T.teal;
  const accentSoft = mode === "register" ? T.amberSoft : T.tealSoft;

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[S.label, isRTL && { textAlign: "right" }]}>{label}</Text>
      <View
        style={[
          S.inputWrap,
          focused && {
            borderColor: accentColor,
            backgroundColor: accentSoft,
            shadowColor: accentColor,
            shadowOpacity: 0.18,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
          },
        ]}
      >
        <TextInput
          style={[S.input, isRTL && { textAlign: "right" }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#C4A98A"
          keyboardType={keyboardType}
          autoCapitalize="none"
          secureTextEntry={secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

/* ─── Main screen ─────────────────────────────────────────────── */
export default function ParentRegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"register" | "login">("register");
  const { lang } = useLang();
  const isRTL = lang === "ar";
  const { toast, showToast } = useToast();

  /* Fade animation on mode switch */
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const switchMode = (next: "register" | "login") => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
    setMode(next);
  };

  const isRegister = mode === "register";
  const accentColor = isRegister ? T.amber : T.teal;
  const accentSoft = isRegister ? T.amberSoft : T.tealSoft;
  const ctaGradient: [string, string] = isRegister
    ? ["#D97706", "#B45309"]
    : ["#0D9488", "#0F766E"];

  const handleRegister = async () => {
    if (!name || !email || !password) {
      showToast(
        isRTL ? "يرجى تعبئة جميع الحقول" : "Please fill in all fields",
        "error",
      );
      return;
    }
    if (password.length < 6) {
      showToast(
        isRTL
          ? "كلمة المرور يجب أن تكون ٦ أحرف على الأقل"
          : "Password must be at least 6 characters",
        "error",
      );
      return;
    }
    setLoading(true);
    try {
      await authService.registerParent(email, password, name);
      router.replace("/(auth)/plans");
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showToast(
        isRTL ? "أدخل البريد وكلمة المرور" : "Enter email and password",
        "error",
      );
      return;
    }
    setLoading(true);
    try {
      await authService.loginParent(email, password);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    /* ── Background gradient — warm dawn ── */
    <LinearGradient
      colors={["#FFFBF5", "#FEF3C7", "#FDF4E7"]}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      <Toast toast={toast} />

      {/* ── Decorative background geometry ── */}

      {/* Large ambient circles */}
      <View style={S.ambientTop} />
      <View style={S.ambientBottom} />

      {/* Floating star ornaments */}
      <View style={{ position: "absolute", top: 88, left: 28 }}>
        <StarDecor size={22} color={T.amber} opacity={0.22} />
      </View>
      <View style={{ position: "absolute", top: 140, right: 44 }}>
        <StarDecor size={14} color={T.teal} opacity={0.18} />
      </View>
      <View style={{ position: "absolute", bottom: 180, left: 36 }}>
        <StarDecor size={16} color={T.amber} opacity={0.15} />
      </View>
      <View style={{ position: "absolute", bottom: 240, right: 30 }}>
        <StarDecor size={20} color={T.violet} opacity={0.12} />
      </View>

      {/* Floating dots */}
      <FloatDot style={{ position: "absolute", top: 220, left: 60 }} />
      <FloatDot
        style={{
          position: "absolute",
          top: 300,
          right: 72,
          backgroundColor: T.teal,
        }}
      />
      <FloatDot
        style={{
          position: "absolute",
          bottom: 300,
          right: 44,
          backgroundColor: T.violet,
          opacity: 0.25,
        }}
      />

      {/* ── Back button (fixed, outside scroll) ── */}
      <Pressable
        style={({ pressed }) => [
          S.backBtn,
          pressed && { opacity: 0.65, transform: [{ scale: 0.93 }] },
        ]}
        onPress={() => router.back()}
      >
        <Text style={S.backBtnText}>{isRTL ? "→" : "←"}</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={S.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero card ── */}
        <View style={S.heroCard}>
          {/* Corner geo dots */}
          <View
            style={{ position: "absolute", top: 16, right: 16, opacity: 0.18 }}
          >
            <StarDecor size={28} color={T.amber} opacity={1} />
          </View>

          {/* Big emoji with glow ring */}
          <View
            style={[
              S.emojiRing,
              { borderColor: `${accentColor}28`, shadowColor: accentColor },
            ]}
          >
            <LinearGradient
              colors={
                isRegister ? ["#FEF3C7", "#FDE68A"] : ["#CCFBF1", "#99F6E4"]
              }
              style={S.emojiGradient}
            >
              <Text style={S.heroEmoji}>{isRegister ? "👨‍👩‍👧" : "👋"}</Text>
            </LinearGradient>
          </View>

          <Text style={S.heroTitle}>
            {isRegister
              ? isRTL
                ? "تسجيل ولي الأمر"
                : "Welcome to Athkari"
              : isRTL
                ? "تسجيل الدخول"
                : "Welcome Back!"}
          </Text>
          <Text style={S.heroSub}>
            {isRegister
              ? isRTL
                ? "أنشئ حسابك لمتابعة أطفالك"
                : "Start your family's journey today"
              : isRTL
                ? "أدخل بياناتك للدخول"
                : "Sign in to your family account"}
          </Text>

          {/* ── Mode toggle ── */}
          <View style={S.toggleWrap}>
            {/* Register pill */}
            <Pressable
              style={{ flex: 1 }}
              onPress={() => switchMode("register")}
            >
              {isRegister ? (
                <LinearGradient
                  colors={["#D97706", "#B45309"]}
                  style={S.pillActive}
                >
                  <Text style={S.pillActiveText}>
                    ✨ {isRTL ? "حساب جديد" : "Register"}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={S.pillInactive}>
                  <Text style={S.pillInactiveText}>
                    ✨ {isRTL ? "حساب جديد" : "Register"}
                  </Text>
                </View>
              )}
            </Pressable>

            {/* Sign-in pill */}
            <Pressable style={{ flex: 1 }} onPress={() => switchMode("login")}>
              {!isRegister ? (
                <LinearGradient
                  colors={["#0D9488", "#0F766E"]}
                  style={S.pillActive}
                >
                  <Text style={S.pillActiveText}>
                    🔑 {isRTL ? "دخول" : "Sign In"}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={S.pillInactive}>
                  <Text style={S.pillInactiveText}>
                    🔑 {isRTL ? "دخول" : "Sign In"}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* ── Form card ── */}
        <Animated.View style={[S.formCard, { opacity: fadeAnim }]}>
          {/* Accent top bar */}
          <LinearGradient
            colors={ctaGradient}
            style={S.formAccentBar}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />

          <View style={S.formInner}>
            {isRegister && (
              <FormInput
                label={`✏️  ${isRTL ? "الاسم الكامل" : "Full Name"}`}
                value={name}
                onChange={setName}
                placeholder={isRTL ? "اسمك الكامل" : "Your full name"}
                isRTL={isRTL}
                mode={mode}
              />
            )}

            <FormInput
              label={`📧  ${isRTL ? "البريد الإلكتروني" : "Email Address"}`}
              value={email}
              onChange={setEmail}
              placeholder="email@example.com"
              keyboardType="email-address"
              isRTL={isRTL}
              mode={mode}
            />

            <FormInput
              label={`🔒  ${isRTL ? "كلمة المرور" : "Password"}`}
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              secureTextEntry
              isRTL={isRTL}
              mode={mode}
            />

            {/* ── CTA button ── */}
            <Pressable
              disabled={loading}
              onPress={isRegister ? handleRegister : handleLogin}
              style={({ pressed }) => [
                S.ctaWrap,
                (loading || pressed) && {
                  opacity: 0.7,
                  transform: [{ scale: 0.97 }],
                },
              ]}
            >
              <LinearGradient
                colors={ctaGradient}
                style={S.ctaBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {/* Inner highlight */}
                <View style={S.ctaHighlight} />
                <Text style={S.ctaText}>
                  {loading
                    ? "⏳  ..."
                    : isRegister
                      ? isRTL
                        ? "🚀  إنشاء الحساب"
                        : "🚀  Create Account"
                      : isRTL
                        ? "🚀  تسجيل الدخول"
                        : "🚀  Sign In"}
                </Text>
              </LinearGradient>
            </Pressable>

            {/* ── Divider ── */}
            <View style={S.dividerRow}>
              <View style={S.dividerLine} />
              <Text style={S.dividerText}>{isRTL ? "أو" : "or"}</Text>
              <View style={S.dividerLine} />
            </View>

            {/* ── Secondary action ── */}
            <Pressable
              style={({ pressed }) => [
                S.secondaryBtn,
                {
                  borderColor: `${accentColor}35`,
                  backgroundColor: accentSoft,
                },
                pressed && { opacity: 0.75 },
              ]}
              onPress={() => switchMode(isRegister ? "login" : "register")}
            >
              <Text style={[S.secondaryBtnText, { color: accentColor }]}>
                {isRegister
                  ? isRTL
                    ? "لدي حساب بالفعل →"
                    : "I already have an account →"
                  : isRTL
                    ? "إنشاء حساب جديد →"
                    : "Create a new account →"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* ── Trust badges ── */}
        <View style={S.trustRow}>
          {[
            { icon: "🔒", label: isRTL ? "آمن" : "Secure" },
            { icon: "👨‍👩‍👧", label: isRTL ? "عائلي" : "Family Safe" },
            { icon: "🌟", label: isRTL ? "تجربة مجانية" : "Free Trial" },
          ].map((b, i) => (
            <View key={i} style={S.trustBadge}>
              <Text style={S.trustIcon}>{b.icon}</Text>
              <Text style={S.trustText}>{b.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </LinearGradient>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */
const S = StyleSheet.create({
  /* Ambient background circles */
  ambientTop: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(217,119,6,0.06)",
    top: -80,
    right: -80,
  },
  ambientBottom: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(13,148,136,0.06)",
    bottom: 60,
    left: -80,
  },

  /* Scroll */
  scroll: {
    padding: 24,
    paddingTop: 68,
    alignItems: "center",
  },

  /* Back button */
  backBtn: {
    position: "absolute",
    top: 54,
    left: 20,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(217,119,6,0.10)",
    borderWidth: 1.5,
    borderColor: "rgba(217,119,6,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 20,
    fontWeight: "900",
    color: T.amber,
  },

  /* ── Hero card ── */
  heroCard: {
    width: "100%",
    backgroundColor: T.white,
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    marginBottom: 14,
    shadowColor: T.amber,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: "rgba(217,119,6,0.08)",
    overflow: "hidden",
  },

  /* Emoji ring */
  emojiRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 6,
    marginBottom: 16,
    overflow: "hidden",
  },
  emojiGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroEmoji: { fontSize: 46 },

  heroTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: T.ink,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 13,
    fontWeight: "600",
    color: T.inkFaint,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },

  /* ── Mode toggle ── */
  toggleWrap: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#F5EBD8",
    borderRadius: 20,
    padding: 4,
    width: "100%",
  },
  pillActive: {
    paddingVertical: 11,
    borderRadius: 16,
    alignItems: "center",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  pillActiveText: {
    fontSize: 13,
    fontWeight: "900",
    color: T.white,
    letterSpacing: 0.2,
  },
  pillInactive: {
    paddingVertical: 11,
    borderRadius: 16,
    alignItems: "center",
  },
  pillInactiveText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#C4A98A",
  },

  /* ── Form card ── */
  formCard: {
    width: "100%",
    backgroundColor: T.white,
    borderRadius: 28,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(217,119,6,0.07)",
    overflow: "hidden",
  },
  formAccentBar: {
    height: 4,
    width: "100%",
  },
  formInner: {
    padding: 22,
  },

  /* ── Input ── */
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: T.inkMid,
    marginBottom: 7,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  inputWrap: {
    backgroundColor: T.creamDark,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(217,119,6,0.14)",
    overflow: "hidden",
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: T.ink,
    fontSize: 15,
    fontWeight: "700",
  },

  /* ── CTA ── */
  ctaWrap: {
    marginTop: 6,
    borderRadius: 20,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 7,
  },
  ctaBtn: {
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  /* Glossy highlight on button */
  ctaHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  ctaText: {
    color: T.white,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  /* ── Divider ── */
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: "rgba(217,119,6,0.12)",
    borderRadius: 1,
  },
  dividerText: {
    color: "#C4A98A",
    marginHorizontal: 14,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  /* ── Secondary btn ── */
  secondaryBtn: {
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
    borderWidth: 2,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.1,
  },

  /* ── Trust badges ── */
  trustRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 6,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: "rgba(217,119,6,0.14)",
    shadowColor: T.amber,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  trustIcon: { fontSize: 14 },
  trustText: {
    fontSize: 11,
    fontWeight: "800",
    color: T.inkMid,
    letterSpacing: 0.2,
  },
});
