import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useState, useRef, useEffect } from "react";
import { referralService } from "@/services/referrals";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { LinearGradient } from "expo-linear-gradient";
import { useToast } from "@/hooks/useToast";
import { Toast } from "@/components/ui";

/* ── Shared night-sky tokens (from KidLoginScreen) ─────────── */
const C = {
  skyDeep: "#0F1E35",
  skySurface: "#162945",
  skyCard: "#1E3554",
  gold: "#FFC843",
  goldSoft: "#FFE89A",
  goldBorder: "rgba(255,200,67,0.30)",
  goldGlow: "rgba(255,200,67,0.18)",
  coral: "#FF6B4A",
  coralLight: "#FF9B82",
  mint: "#3DD9A4",
  mintGlow: "rgba(61,217,164,0.18)",
  violet: "#A78BFA",
  violetGlow: "rgba(167,139,250,0.18)",
  white: "#FFFFFF",
  cream: "#F0E8D8",
  muted: "#7A9BBC",
  dim: "#3D5876",
  error: "#FF6B6B",
  errorSoft: "rgba(255,107,107,0.14)",
};

/* ── Twinkling star ─────────────────────────────────────────── */
function StarDot({
  x,
  y,
  size = 2.5,
  delay = 0,
  color = C.gold,
}: {
  x: number;
  y: number;
  size?: number;
  delay?: number;
  color?: string;
}) {
  const anim = useRef(new Animated.Value(0.15)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.15,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: anim,
      }}
    />
  );
}

/* ── 8-pointed star ornament ─────────────────────────────────── */
function StarShape({ size = 14, color = C.gold, opacity = 0.2 }) {
  const s = size * 0.62;
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        opacity,
      }}
    >
      <View
        style={{
          position: "absolute",
          width: s,
          height: s,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: s,
          height: s,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

export default function ReferralScreen() {
  const [code, setCode] = useState("");
  const [valid, setValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);
  const { lang } = useLang();
  const { activeKid, kids, role } = useAuth();
  const isRTL = lang === "ar";
  const newKidId = activeKid?.id ?? kids[kids.length - 1]?.id;
  const { toast, showToast } = useToast();
  const destination =
    role === "parent" ? "/(parent-dashboard)/kids" : "/(tabs)/home";

  /* Slide-in */
  const slideY = useRef(new Animated.Value(32)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, {
        toValue: 0,
        tension: 160,
        friction: 14,
        useNativeDriver: true,
      }),
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  /* Success bounce */
  const successScale = useRef(new Animated.Value(0)).current;
  const triggerSuccess = () => {
    Animated.spring(successScale, {
      toValue: 1,
      tension: 200,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const handleVerify = async () => {
    if (code.length < 6) {
      setValid(false);
      return;
    }
    setLoading(true);
    try {
      const res = await referralService.verifyKidCode(code);
      const isValid = res !== null && res.id !== newKidId;
      setValid(isValid);
      if (isValid && res) {
        // Code is valid — mark applied immediately so UX is smooth
        setApplied(true);
        triggerSuccess();
        // Try to award stars via edge function; failure here is non-blocking
        if (newKidId) {
          try {
            await referralService.applyKidReferral(res.id, newKidId);
          } catch (applyErr: any) {
            // "Referral already applied" is fine — no need to surface it
            const msg: string = applyErr?.message ?? "";
            if (!msg.toLowerCase().includes("already")) {
              console.warn("referral-apply:", msg);
            }
          }
        }
      }
    } catch (e: any) {
      setValid(false);
      showToast(
        e.message || (isRTL ? "حدث خطأ" : "Something went wrong"),
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[C.skyDeep, C.skySurface, "#0F2236"]}
      locations={[0, 0.55, 1]}
      style={{ flex: 1 }}
    >
      <Toast toast={toast} />

      {/* Ambient glows */}
      <View
        style={{
          position: "absolute",
          top: -60,
          left: -60,
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: C.goldGlow,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 80,
          right: -60,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: C.mintGlow,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: "50%",
          right: -40,
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: C.violetGlow,
        }}
      />

      {/* Stars */}
      <StarDot x={28} y={90} size={2.5} delay={0} color={C.gold} />
      <StarDot x={320} y={70} size={3} delay={400} color={C.goldSoft} />
      <StarDot x={60} y={240} size={2} delay={800} color={C.mint} />
      <StarDot x={290} y={300} size={2.5} delay={200} color={C.gold} />
      <StarDot x={40} y={500} size={2} delay={1000} color={C.violet} />
      <StarDot x={330} y={540} size={3} delay={600} color={C.gold} />

      {/* Star ornaments */}
      <View style={{ position: "absolute", top: 110, left: 22 }}>
        <StarShape size={18} color={C.gold} opacity={0.2} />
      </View>
      <View style={{ position: "absolute", top: 200, right: 30 }}>
        <StarShape size={12} color={C.mint} opacity={0.18} />
      </View>
      <View style={{ position: "absolute", bottom: 220, left: 30 }}>
        <StarShape size={16} color={C.violet} opacity={0.15} />
      </View>

      <Animated.View
        style={[
          S.centerWrap,
          { opacity: fadeIn, transform: [{ translateY: slideY }] },
        ]}
      >
        {/* Gift icon with orbit ring */}
        <View style={S.iconOrbitWrap}>
          <View style={[S.iconOrbit, { borderColor: C.goldBorder }]} />
          <LinearGradient colors={[C.skyCard, "#243F64"]} style={S.iconInner}>
            <Text style={{ fontSize: 44 }}>🎁</Text>
          </LinearGradient>
          <View
            style={[
              S.orbitDot,
              { top: -5, left: "48%", backgroundColor: C.gold },
            ]}
          />
          <View
            style={[
              S.orbitDot,
              { bottom: -5, left: "48%", backgroundColor: C.mint },
            ]}
          />
          <View
            style={[
              S.orbitDot,
              { left: -5, top: "48%", backgroundColor: C.coral },
            ]}
          />
          <View
            style={[
              S.orbitDot,
              { right: -5, top: "48%", backgroundColor: C.violet },
            ]}
          />
        </View>

        <Text style={S.title}>
          {isRTL ? "هل عندك كود صديق؟" : "Friend Code? 🌟"}
        </Text>
        <Text style={S.sub}>
          {isRTL
            ? "أدخل كود صديقك واحصل على نجوم مجانية!"
            : "Enter your friend's code and earn free stars!"}
        </Text>

        {/* Glass card */}
        <View style={S.card}>
          <View style={S.cardShine} />

          {/* Code input */}
          <TextInput
            style={S.codeInput}
            value={code}
            onChangeText={(v) => {
              setCode(v.toUpperCase().slice(0, 8));
              setValid(null);
            }}
            placeholder={isRTL ? "أدخل الكود هنا" : "Enter code here"}
            placeholderTextColor={C.dim}
            maxLength={8}
            autoCapitalize="characters"
            editable={!applied}
            autoFocus
          />

          {/* Feedback */}
          {valid === true && (
            <Animated.View
              style={[
                S.feedbackPill,
                S.feedbackSuccess,
                { transform: [{ scale: successScale }] },
              ]}
            >
              <Text style={S.feedbackText}>
                {applied
                  ? isRTL
                    ? "✅ تم تفعيل الكود! صديقك يحصل على ٥٠ 🌟"
                    : "✅ Code applied! Your friend earns 50 🌟"
                  : isRTL
                    ? "✅ كود صحيح!"
                    : "✅ Valid code!"}
              </Text>
            </Animated.View>
          )}
          {valid === false && (
            <View style={[S.feedbackPill, S.feedbackError]}>
              <Text style={S.feedbackText}>
                {isRTL ? "❌ كود غير صحيح" : "❌ Invalid code — try again"}
              </Text>
            </View>
          )}

          {/* Verify button */}
          {code.length > 0 && !applied && (
            <Pressable
              onPress={handleVerify}
              disabled={loading}
              style={({ pressed }) => [
                S.verifyBtn,
                (loading || pressed) && { opacity: 0.7 },
              ]}
            >
              <LinearGradient
                colors={[C.coral, "#E85A3C"]}
                style={S.verifyGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={S.btnGloss} />
                <Text style={S.verifyText}>
                  {loading ? "..." : isRTL ? "تحقق ✨" : "Verify ✨"}
                </Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>

        {/* Stars reward preview */}
        <View style={S.rewardRow}>
          {["🌟 +50 Stars", "🎯 Bonus XP", "🏆 Badge"].map((r, i) => (
            <View key={i} style={S.rewardChip}>
              <Text style={S.rewardChipText}>{r}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <Pressable
          onPress={() => router.replace(destination as any)}
          style={({ pressed }) => [S.ctaWrap, pressed && { opacity: 0.8 }]}
        >
          <LinearGradient
            colors={[C.gold, "#E6A800"]}
            style={S.ctaBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={S.btnGloss} />
            <Text style={S.ctaText}>
              {isRTL ? "ابدأ المغامرة! 🚀" : "Let's Go! 🚀"}
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={() => router.replace(destination as any)}
          style={S.skipBtn}
        >
          <Text style={S.skipText}>{isRTL ? "تخطي" : "Skip for now"}</Text>
        </Pressable>
      </Animated.View>
    </LinearGradient>
  );
}

const C2 = { goldGlow: "rgba(255,200,67,0.12)" };

const S = StyleSheet.create({
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },

  /* Icon orbit */
  iconOrbitWrap: {
    width: 110,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  iconOrbit: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderStyle: "dashed",
  },
  iconInner: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,200,67,0.22)",
    shadowColor: "#FFC843",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  orbitDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    marginTop: -5,
  },

  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  sub: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7A9BBC",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 19,
  },

  /* Card */
  card: {
    width: "100%",
    backgroundColor: "#1E3554",
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.07)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  cardShine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.09)",
  },

  /* Code input */
  codeInput: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,200,67,0.25)",
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: "900",
    color: C.gold,
    textAlign: "center",
    letterSpacing: 6,
    marginBottom: 18,
    direction: "ltr",
  },

  /* Feedback */
  feedbackPill: {
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    width: "100%",
    alignItems: "center",
  },
  feedbackSuccess: {
    backgroundColor: "rgba(61,217,164,0.12)",
    borderColor: "rgba(61,217,164,0.28)",
  },
  feedbackError: {
    backgroundColor: "rgba(255,107,107,0.12)",
    borderColor: "rgba(255,107,107,0.25)",
  },
  feedbackText: { fontSize: 13, fontWeight: "800", color: "#F0E8D8" },

  /* Verify */
  verifyBtn: {
    width: "100%",
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 7,
  },
  verifyGrad: {
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: "center",
    overflow: "hidden",
  },
  verifyText: {
    fontSize: 16,
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
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },

  /* Reward row */
  rewardRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 20,
  },
  rewardChip: {
    backgroundColor: "rgba(255,200,67,0.10)",
    borderWidth: 1.5,
    borderColor: "rgba(255,200,67,0.22)",
    borderRadius: 50,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  rewardChipText: { fontSize: 11, fontWeight: "800", color: "#FFC843" },

  /* CTA */
  ctaWrap: {
    width: "100%",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#FFC843",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaBtn: {
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: "center",
    overflow: "hidden",
  },
  ctaText: { fontSize: 17, fontWeight: "900", color: "#0F1E35" },

  skipBtn: { marginTop: 16, padding: 10 },
  skipText: { fontSize: 13, fontWeight: "700", color: "#3D5876" },
});
