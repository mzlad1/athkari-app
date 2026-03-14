import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useRef, useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { T } from "@/constants/translations";
import { LinearGradient } from "expo-linear-gradient";

const { width: SW, height: SH } = Dimensions.get("window");

/* ─── Brand ────────────────────────────────────────────────────
   Parent world  → Warm Dawn (amber/cream)
   Kid world     → Night Sky (deep navy/gold/coral)
   This screen   → Bridge: creamy white → deep dusk gradient
   ─────────────────────────────────────────────────────────── */
const DAWN = {
  amber: "#D97706",
  amberLight: "#F59E0B",
  amberSoft: "#FEF3C7",
  amberBorder: "rgba(217,119,6,0.30)",
  amberGlow: "rgba(217,119,6,0.20)",
};
const NIGHT = {
  sky: "#0F1E35",
  surface: "#162945",
  gold: "#FFC843",
  goldGlow: "rgba(255,200,67,0.22)",
  coral: "#FF6B4A",
  mint: "#3DD9A4",
};

/* ─── Twinkling star particle ──────────────────────────────── */
function StarDot({
  x,
  y,
  size = 2.5,
  delay = 0,
  color = NIGHT.gold,
}: {
  x: number;
  y: number;
  size?: number;
  delay?: number;
  color?: string;
}) {
  const a = useRef(new Animated.Value(0.1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(a, {
          toValue: 1,
          duration: 600 + Math.random() * 400,
          useNativeDriver: true,
        }),
        Animated.timing(a, {
          toValue: 0.1,
          duration: 700 + Math.random() * 400,
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
        opacity: a,
      }}
    />
  );
}

/* ─── Sunray line (parent card decoration) ─────────────────── */
function SunRay({ angle, opacity = 0.08 }: { angle: number; opacity?: number }) {
  return (
    <View
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 200,
        height: 1.5,
        backgroundColor: "#FFFFFF",
        opacity,
        transform: [
          { translateX: -100 },
          { translateY: -0.75 },
          { rotate: `${angle}deg` },
        ],
      }}
    />
  );
}

/* ─── 8-pointed Islamic star ───────────────────────────────── */
function StarGeo({ size = 14, color = "#FFFFFF", opacity = 0.15 }) {
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

export default function RoleSelectScreen() {
  const { lang, toggleLang } = useLang();
  const { setRole } = useAuth();
  const isRTL = lang === "ar";
  const t = T[lang];

  /* Hero float */
  const floatY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -12,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  /* Cards slide in */
  const parentSlide = useRef(new Animated.Value(60)).current;
  const kidSlide = useRef(new Animated.Value(80)).current;
  const parentAlpha = useRef(new Animated.Value(0)).current;
  const kidAlpha = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.stagger(120, [
      Animated.parallel([
        Animated.spring(parentSlide, {
          toValue: 0,
          tension: 140,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(parentAlpha, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(kidSlide, {
          toValue: 0,
          tension: 140,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(kidAlpha, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  /* Press scale helper */
  const usePress = () => {
    const s = useRef(new Animated.Value(1)).current;
    const press = () =>
      Animated.spring(s, {
        toValue: 0.96,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }).start();
    const release = () =>
      Animated.spring(s, {
        toValue: 1,
        useNativeDriver: true,
        tension: 280,
        friction: 10,
      }).start();
    return { scale: s, press, release };
  };
  const parentPress = usePress();
  const kidPress = usePress();

  return (
    /* ── Background: soft dawn twilight ── */
    <LinearGradient
      colors={["#FFF8F0", "#FEF3C7", "#E8F4F8", "#D6EAF8"]}
      locations={[0, 0.35, 0.7, 1]}
      style={R.bg}
    >
      {/* Global ambient glows */}
      <View style={[R.ambientTop, { backgroundColor: DAWN.amberGlow }]} />
      <View style={[R.ambientBottom, { backgroundColor: NIGHT.goldGlow }]} />
      <View
        style={{
          position: "absolute",
          top: "35%",
          left: -60,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: "rgba(13,148,136,0.05)",
        }}
      />

      {/* Floating geo stars at edges */}
      <View style={{ position: "absolute", top: 130, left: 18 }}>
        <StarGeo size={20} color={DAWN.amber} opacity={0.18} />
      </View>
      <View style={{ position: "absolute", top: 220, right: 22 }}>
        <StarGeo size={14} color={NIGHT.gold} opacity={0.15} />
      </View>
      <View style={{ position: "absolute", bottom: 160, left: 24 }}>
        <StarGeo size={16} color="#0D9488" opacity={0.13} />
      </View>
      <View style={{ position: "absolute", bottom: 240, right: 18 }}>
        <StarGeo size={22} color={DAWN.amber} opacity={0.12} />
      </View>

      {/* ── Top bar ── */}
      <View style={[R.topBar, isRTL && { flexDirection: "row-reverse" }]}>
        <Pressable
          style={({ pressed }) => [R.langBtn, pressed && { opacity: 0.7 }]}
          onPress={toggleLang}
        >
          <Text style={R.langText}>🌍 {t.lang}</Text>
        </Pressable>
        <View style={R.appBrand}>
          <Text style={R.appBrandText}>Athkari</Text>
          <View style={R.appBrandDot} />
        </View>
      </View>

      {/* ── Hero section ── */}
      <View style={R.heroSection}>
        {/* Moon + hand floating emoji stack */}
        <View style={R.heroEmojiStack}>
          <Animated.Text
            style={[R.heroMoon, { transform: [{ translateY: floatY }] }]}
          >
            🌙
          </Animated.Text>
          <Animated.View
            style={[
              R.heroHandWrap,
              { transform: [{ translateY: Animated.multiply(floatY, -0.6) }] },
            ]}
          >
            <LinearGradient
              colors={["rgba(255,200,67,0.25)", "rgba(255,200,67,0.08)"]}
              style={R.heroHandGrad}
            >
              <Text style={R.heroHand}>🤲</Text>
            </LinearGradient>
          </Animated.View>
        </View>

        <Text style={R.heroTitle}>
          {isRTL ? "أهلاً بكم في أذكاري" : "Welcome to Athkari"}
        </Text>
        <Text style={R.heroSub}>
          {isRTL
            ? "اختر دورك للبدء في الرحلة"
            : "Choose your role to begin the journey"}
        </Text>
      </View>

      {/* ── Role cards ── */}
      <View style={R.cards}>
        {/* ══ PARENT CARD — Warm Dawn ══ */}
        <Animated.View
          style={{
            transform: [
              { translateY: parentSlide },
              { scale: parentPress.scale },
            ],
            opacity: parentAlpha,
          }}
        >
          <Pressable
            onPressIn={parentPress.press}
            onPressOut={parentPress.release}
            onPress={() => {
              setRole("parent");
              router.push("/(auth)/parent-register");
            }}
            style={R.cardPressable}
          >
            <LinearGradient
              colors={["#D97706", "#B45309", "#92400E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={R.parentCard}
            >
              {/* Sun rays decoration */}
              {[0, 30, 60, 90, 120, 150].map((a) => (
                <SunRay key={a} angle={a} opacity={0.06} />
              ))}

              {/* Inner glow ring */}
              <View
                style={[
                  R.cardGlowRing,
                  { borderColor: "rgba(255,255,255,0.15)" },
                ]}
              />

              {/* Top shine */}
              <View style={R.cardTopShine} />

              <View style={R.cardBody}>
                {/* Avatar ring */}
                <View
                  style={[
                    R.cardAvatarRing,
                    { borderColor: "rgba(255,255,255,0.30)" },
                  ]}
                >
                  <LinearGradient
                    colors={[
                      "rgba(255,255,255,0.22)",
                      "rgba(255,255,255,0.10)",
                    ]}
                    style={R.cardAvatarInner}
                  >
                    <Text style={{ fontSize: 34 }}>👨‍👩‍👧</Text>
                  </LinearGradient>
                </View>

                {/* Text */}
                <View style={{ flex: 1 }}>
                  <Text style={R.cardRole}>{t.iAmParent}</Text>
                  <Text style={R.cardSub}>{t.parentSubtitle}</Text>
                </View>

                {/* Arrow */}
                <View style={R.cardArrow}>
                  <Text style={R.cardArrowText}>{isRTL ? "‹" : "›"}</Text>
                </View>
              </View>

              {/* Feature pills */}
              <View style={R.pillRow}>
                {(isRTL
                  ? ["📊 متابعة", "🔒 تحكم", "📈 تقارير"]
                  : ["📊 Track", "🔒 Control", "📈 Reports"]
                ).map((f, i) => (
                  <View
                    key={i}
                    style={[
                      R.pill,
                      { backgroundColor: "rgba(255,255,255,0.18)" },
                    ]}
                  >
                    <Text style={R.pillText}>{f}</Text>
                  </View>
                ))}
              </View>

              {/* Watermark */}
              <Text style={R.cardWatermark}>🌅</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* ══ KID CARD — Night Sky ══ */}
        <Animated.View
          style={{
            transform: [{ translateY: kidSlide }, { scale: kidPress.scale }],
            opacity: kidAlpha,
          }}
        >
          <Pressable
            onPressIn={kidPress.press}
            onPressOut={kidPress.release}
            onPress={() => router.push("/(auth)/kid-login")}
            style={R.cardPressable}
          >
            <LinearGradient
              colors={[NIGHT.sky, "#1A3050", "#0A2540"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={R.kidCard}
            >
              {/* Live star particles inside card */}
              <StarDot x={14} y={12} size={2} delay={0} color={NIGHT.gold} />
              <StarDot x={260} y={18} size={2.5} delay={300} color="#FFE89A" />
              <StarDot
                x={50}
                y={48}
                size={1.5}
                delay={600}
                color={NIGHT.mint}
              />
              <StarDot x={220} y={55} size={2} delay={900} color={NIGHT.gold} />
              <StarDot
                x={160}
                y={10}
                size={2}
                delay={450}
                color={NIGHT.coral}
              />
              <StarDot
                x={290}
                y={70}
                size={1.5}
                delay={750}
                color={NIGHT.gold}
              />
              <StarDot x={30} y={90} size={2} delay={200} color="#FFE89A" />
              <StarDot
                x={200}
                y={90}
                size={1.5}
                delay={1100}
                color={NIGHT.mint}
              />

              {/* Inner glow ring */}
              <View
                style={[
                  R.cardGlowRing,
                  { borderColor: "rgba(255,200,67,0.18)" },
                ]}
              />

              {/* Top shine */}
              <View style={R.cardTopShine} />

              {/* Islamic star geo ornaments */}
              <View style={{ position: "absolute", top: 14, right: 80 }}>
                <StarGeo size={12} color={NIGHT.gold} opacity={0.22} />
              </View>
              <View style={{ position: "absolute", bottom: 44, left: 20 }}>
                <StarGeo size={10} color={NIGHT.mint} opacity={0.2} />
              </View>

              <View style={R.cardBody}>
                {/* Avatar ring with gold glow */}
                <View
                  style={[
                    R.cardAvatarRing,
                    {
                      borderColor: "rgba(255,200,67,0.40)",
                      shadowColor: NIGHT.gold,
                      shadowOpacity: 0.4,
                      shadowRadius: 12,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 5,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[NIGHT.goldGlow, "rgba(255,200,67,0.05)"]}
                    style={R.cardAvatarInner}
                  >
                    <Text style={{ fontSize: 34 }}>🌟</Text>
                  </LinearGradient>
                </View>

                {/* Text */}
                <View style={{ flex: 1 }}>
                  <Text style={R.cardRole}>{t.iAmKid}</Text>
                  <Text
                    style={[R.cardSub, { color: "rgba(255,255,255,0.60)" }]}
                  >
                    {t.kidSubtitle}
                  </Text>
                </View>

                {/* Arrow with gold glow */}
                <View
                  style={[
                    R.cardArrow,
                    {
                      borderColor: "rgba(255,200,67,0.25)",
                      shadowColor: NIGHT.gold,
                      shadowOpacity: 0.4,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 0 },
                    },
                  ]}
                >
                  <Text style={R.cardArrowText}>{isRTL ? "‹" : "›"}</Text>
                </View>
              </View>

              {/* Feature pills */}
              <View style={R.pillRow}>
                {(isRTL
                  ? ["📿 أذكار", "🏆 تحديات", "⭐ نجوم"]
                  : ["📿 Dhikr", "🏆 Challenges", "⭐ Stars"]
                ).map((f, i) => (
                  <View
                    key={i}
                    style={[
                      R.pill,
                      {
                        backgroundColor: "rgba(255,200,67,0.12)",
                        borderColor: "rgba(255,200,67,0.22)",
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text style={[R.pillText, { color: "#FFE89A" }]}>{f}</Text>
                  </View>
                ))}
              </View>

              {/* Watermark moon */}
              <Text style={[R.cardWatermark, { opacity: 0.07 }]}>🌙</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>

      {/* Footer */}
      <Text style={R.footer}>
        {isRTL
          ? "مصنوع بـ ❤️ للأسر المسلمة"
          : "Made with ❤️ for Muslim families"}
      </Text>
    </LinearGradient>
  );
}

const R = StyleSheet.create({
  bg: { flex: 1, paddingHorizontal: 22, paddingTop: 52, paddingBottom: 24 },

  ambientTop: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  ambientBottom: {
    position: "absolute",
    bottom: 40,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
  },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  langBtn: {
    backgroundColor: "rgba(217,119,6,0.10)",
    borderWidth: 1.5,
    borderColor: "rgba(217,119,6,0.22)",
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  langText: { fontSize: 12, fontWeight: "800", color: "#D97706" },
  appBrand: { flexDirection: "row", alignItems: "center", gap: 6 },
  appBrandText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1C1017",
    letterSpacing: -0.5,
  },
  appBrandDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#D97706",
    shadowColor: "#D97706",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 3,
  },

  /* Hero */
  heroSection: { alignItems: "center", marginBottom: 24, marginTop: 8 },
  heroEmojiStack: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    position: "relative",
  },
  heroMoon: {
    position: "absolute",
    top: -8,
    right: -4,
    fontSize: 32,
    opacity: 0.55,
  },
  heroHandWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    borderWidth: 2.5,
    borderColor: "rgba(217,119,6,0.25)",
    shadowColor: "#D97706",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  heroHandGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroHand: { fontSize: 52 },
  heroTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#1C1017",
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 5,
  },
  heroSub: {
    fontSize: 14,
    fontWeight: "600",
    color: "#78716C",
    textAlign: "center",
  },

  /* Cards */
  cards: { gap: 14, flex: 1, justifyContent: "center" },
  cardPressable: { borderRadius: 28 },

  /* Shared card structure */
  parentCard: {
    padding: 20,
    borderRadius: 28,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#B45309",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 24,
    elevation: 14,
  },
  kidCard: {
    padding: 20,
    borderRadius: 28,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1.5,
    borderColor: "rgba(255,200,67,0.18)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 14,
  },
  cardGlowRing: {
    position: "absolute",
    inset: 0,
    borderRadius: 28,
    borderWidth: 1,
  },
  cardTopShine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  cardWatermark: {
    position: "absolute",
    fontSize: 110,
    opacity: 0.06,
    right: -8,
    top: -10,
    pointerEvents: "none",
  },

  cardBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  cardAvatarRing: {
    width: 58,
    height: 58,
    borderRadius: 20,
    borderWidth: 2,
    overflow: "hidden",
  },
  cardAvatarInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  cardRole: {
    fontSize: 19,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  cardSub: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.72)",
    marginTop: 3,
    lineHeight: 17,
  },
  cardArrow: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardArrowText: { fontSize: 20, color: "#FFFFFF", fontWeight: "900" },

  pillRow: { flexDirection: "row", gap: 7 },
  pill: { borderRadius: 50, paddingHorizontal: 11, paddingVertical: 5 },
  pillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.92)",
  },

  /* Footer */
  footer: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: "#A8A29E",
    marginTop: 16,
  },
});
