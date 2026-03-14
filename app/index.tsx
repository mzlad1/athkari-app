import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useState, useRef, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "@/constants/theme";
import { T } from "@/constants/translations";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { Loading } from "@/components/ui";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "@/services/supabase";

const ONBOARDING_KEY = "@onboarding_done";

const { width } = Dimensions.get("window");

// Visual theming per-slide (cycles if DB has more screens)
const SLIDE_THEMES = [
  {
    colors: ["#FFF7ED", "#FEF3C7"] as [string, string],
    accent: "#F97316",
    accentLight: "#FED7AA",
    dotGrad: ["#F97316", "#FB923C"] as [string, string],
    blob1: "rgba(249,115,22,0.10)",
    blob2: "rgba(245,158,11,0.07)",
  },
  {
    colors: ["#F5F3FF", "#EDE9FE"] as [string, string],
    accent: "#7C3AED",
    accentLight: "#DDD6FE",
    dotGrad: ["#7C3AED", "#A855F7"] as [string, string],
    blob1: "rgba(124,58,237,0.10)",
    blob2: "rgba(168,85,247,0.07)",
  },
  {
    colors: ["#FFF7ED", "#ECFDF5"] as [string, string],
    accent: "#10B981",
    accentLight: "#A7F3D0",
    dotGrad: ["#10B981", "#34D399"] as [string, string],
    blob1: "rgba(16,185,129,0.10)",
    blob2: "rgba(52,211,153,0.07)",
  },
];

// Hardcoded fallback in case DB fetch fails
const FALLBACK_SCREENS = [
  {
    key: "ob1",
    emoji: "🤲",
    title_en: "Welcome to Athkari",
    title_ar: "أهلاً بك في أذكاري",
    desc_en:
      "An app that helps your child learn daily adhkar in a fun way with friends",
    desc_ar: "تطبيق يساعد طفلك على حفظ الأذكار بطريقة ممتعة مع أصدقائه",
  },
  {
    key: "ob2",
    emoji: "🏆",
    title_en: "Challenge Your Friends!",
    title_ar: "تحدَّ أصدقاءك!",
    desc_en:
      "Invite friends, compete in reading adhkar, and collect stars together",
    desc_ar: "ادعُ أصدقاءك وتنافسوا على قراءة الأذكار واجمعوا النجوم معاً",
  },
  {
    key: "ob3",
    emoji: "🔥",
    title_en: "Keep Your Streak",
    title_ar: "حافظ على سلسلتك",
    desc_en:
      "Read your adhkar every day and watch your rank rise among friends",
    desc_ar: "اقرأ أذكارك كل يوم وشاهد ترتيبك يرتفع بين أصدقائك",
  },
];

interface ScreenData {
  key: string;
  emoji: string;
  title_en: string;
  title_ar: string;
  desc_en: string;
  desc_ar: string;
}

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [screens, setScreens] = useState<ScreenData[]>(FALLBACK_SCREENS);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const { lang, toggleLang } = useLang();
  const { loading, session } = useAuth();
  const isRTL = lang === "ar";
  const t = T[lang];

  // Fetch onboarding screens from DB
  useEffect(() => {
    supabase
      .from("onboarding_screens")
      .select(
        "id, title_en, title_ar, desc_en, desc_ar, illustration, display_order",
      )
      .eq("is_active", true)
      .order("display_order")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setScreens(
            data.map((row: any, i: number) => ({
              key: `db_${row.id}`,
              emoji: row.illustration || "🤲",
              title_en: row.title_en,
              title_ar: row.title_ar,
              desc_en: row.desc_en || "",
              desc_ar: row.desc_ar || "",
            })),
          );
        }
      });
  }, []);

  // Check if onboarding was already completed
  useEffect(() => {
    // DEV ONLY: uncomment the next line to always show onboarding
    AsyncStorage.removeItem(ONBOARDING_KEY);
    AsyncStorage.getItem(ONBOARDING_KEY).then((value) => {
      if (value === "true" && !session) {
        router.replace("/(auth)/role-select");
      } else {
        setCheckingOnboarding(false);
      }
    });
  }, [session]);

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const emojiScale = useRef(new Animated.Value(1)).current;
  const emojiFloat = useRef(new Animated.Value(0)).current;

  // Floating emoji animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(emojiFloat, {
          toValue: -12,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(emojiFloat, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [step]);

  const markOnboardingDone = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
  };

  if (loading || session || checkingOnboarding)
    return <Loading message={isRTL ? "جاري التحميل..." : "Loading..."} />;

  const theme = SLIDE_THEMES[step % SLIDE_THEMES.length];
  const screen = screens[step];
  const screenTitle = isRTL ? screen.title_ar : screen.title_en;
  const screenDesc = isRTL ? screen.desc_ar : screen.desc_en;

  const transitionTo = (nextStep: number) => {
    // Pop the emoji
    Animated.sequence([
      Animated.spring(emojiScale, {
        toValue: 1.18,
        useNativeDriver: true,
        speed: 40,
      }),
      Animated.spring(emojiScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 40,
      }),
    ]).start();
    // Fade + slide content out then in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: isRTL ? 30 : -30,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(isRTL ? -30 : 30);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleNext = async () => {
    if (step < screens.length - 1) {
      transitionTo(step + 1);
    } else {
      await markOnboardingDone();
      router.replace("/(auth)/role-select");
    }
  };

  const isLast = step === screens.length - 1;

  return (
    <LinearGradient
      colors={theme.colors}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Decorative blobs */}
      <View style={[styles.blob1, { backgroundColor: theme.blob1 }]} />
      <View style={[styles.blob2, { backgroundColor: theme.blob2 }]} />

      {/* ── Top Bar ── */}
      <View style={[styles.topBar, isRTL && { flexDirection: "row-reverse" }]}>
        <Pressable
          style={[
            styles.langBtn,
            {
              borderColor: theme.accent + "44",
              backgroundColor: theme.accent + "18",
            },
          ]}
          onPress={toggleLang}
        >
          <Text style={[styles.langText, { color: theme.accent }]}>
            🌍 {t.lang}
          </Text>
        </Pressable>
        {!isLast && (
          <Pressable
            style={styles.skipBtn}
            onPress={async () => {
              await markOnboardingDone();
              router.replace("/(auth)/role-select");
            }}
          >
            <Text style={styles.skipText}>{t.skip}</Text>
          </Pressable>
        )}
      </View>

      {/* ── Slide indicator ── */}
      <View style={styles.slideIndicator}>
        <Text style={[styles.slideIndicatorText, { color: theme.accent }]}>
          {step + 1}/{screens.length}
        </Text>
      </View>

      {/* ── Content ── */}
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* Emoji hero */}
        <Animated.View
          style={[
            styles.emojiWrap,
            { backgroundColor: theme.accentLight, shadowColor: theme.accent },
            { transform: [{ scale: emojiScale }, { translateY: emojiFloat }] },
          ]}
        >
          <Text style={styles.emoji}>{screen.emoji}</Text>
        </Animated.View>

        {/* Accent pill */}
        <View style={[styles.accentPill, { backgroundColor: theme.accent }]}>
          <Text style={styles.accentPillText}>
            {step === 0
              ? isRTL
                ? "أهلاً وسهلاً! 👋"
                : "Welcome! 👋"
              : step === 1
                ? isRTL
                  ? "جمع النقاط 🌟"
                  : "Earn Stars 🌟"
                : isRTL
                  ? "ابدأ الرحلة 🚀"
                  : "Start Journey 🚀"}
          </Text>
        </View>

        <Text style={styles.title}>{screenTitle}</Text>
        <Text style={styles.desc}>{screenDesc}</Text>
      </Animated.View>

      {/* ── Dot Indicators ── */}
      <View style={styles.dots}>
        {screens.map((s, i) => (
          <Pressable key={s.key} onPress={() => i < step && transitionTo(i)}>
            {i === step ? (
              <LinearGradient
                colors={theme.dotGrad}
                style={styles.dotActive}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            ) : (
              <View
                style={[
                  styles.dot,
                  i < step && { backgroundColor: theme.accentLight },
                ]}
              />
            )}
          </Pressable>
        ))}
      </View>

      {/* ── CTA Button ── */}
      <Pressable
        style={({ pressed }) => [
          { transform: [{ scale: pressed ? 0.97 : 1 }] },
        ]}
        onPress={handleNext}
      >
        <LinearGradient
          colors={theme.dotGrad}
          style={styles.btn}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.btnText}>
            {isLast
              ? isRTL
                ? "ابدأ الآن! 🚀"
                : "Let's Go! 🚀"
              : isRTL
                ? `التالي ←`
                : `Next →`}
          </Text>
        </LinearGradient>
      </Pressable>

      {/* ── Bottom trust line ── */}
      <Text style={styles.trustLine}>
        {isRTL ? "🔒 آمن • مجاني • إسلامي 💚" : "🔒 Safe • Free • Islamic 💚"}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
    gap: 0,
  },

  // Blobs
  blob1: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -60,
    right: -80,
  },
  blob2: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: 80,
    left: -60,
  },

  // Top bar
  topBar: {
    position: "absolute",
    top: 58,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  langBtn: {
    borderWidth: 1.5,
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  langText: { fontSize: 12, fontWeight: "800" },
  skipBtn: {
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  skipText: { color: "#78716C", fontSize: 13, fontWeight: "700" },

  // Slide counter
  slideIndicator: {
    position: "absolute",
    top: 62,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  slideIndicatorText: { fontSize: 12, fontWeight: "800", opacity: 0.5 },

  // Content
  content: { alignItems: "center", gap: 14, marginBottom: 8 },

  // Emoji hero
  emojiWrap: {
    width: 160,
    height: 160,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 12,
  },
  emoji: { fontSize: 80 },

  // Accent pill above title
  accentPill: {
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  accentPillText: { color: "#fff", fontSize: 13, fontWeight: "900" },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1C1917",
    textAlign: "center",
    lineHeight: 42,
  },
  desc: {
    fontSize: 15,
    color: "#78716C",
    textAlign: "center",
    lineHeight: 26,
    maxWidth: 290,
    fontWeight: "600",
  },

  // Dots
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 28,
    marginBottom: 20,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E7E5E4",
  },
  dotActive: {
    width: 28,
    height: 10,
    borderRadius: 5,
  },

  // CTA
  btn: {
    borderRadius: 20,
    paddingVertical: 17,
    alignItems: "center",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 10,
  },
  btnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  // Trust
  trustLine: {
    textAlign: "center",
    color: "#A8A29E",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 18,
  },
});
