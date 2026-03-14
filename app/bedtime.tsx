import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { Animated } from "react-native";
import { COLORS } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { useAdhkar } from "@/hooks/useAdhkar";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SLEEP_ADHKAR_CATEGORY_KEY = "sleep"; // Will look for sleep category

export default function BedtimeScreen() {
  const { activeKid } = useAuth();
  const { lang } = useLang();
  const isRTL = lang === "ar";

  // Find sleep category (id=3 typically, but we query by key)
  const [sleepCategoryId, setSleepCategoryId] = useState<number | null>(null);
  const { adhkar, loading } = useAdhkar(sleepCategoryId);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [allDone, setAllDone] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Fetch sleep category ID
  useEffect(() => {
    const { supabase } = require("@/services/supabase");
    supabase
      .from("categories")
      .select("id")
      .eq("key", SLEEP_ADHKAR_CATEGORY_KEY)
      .single()
      .then(({ data }: any) => {
        if (data) setSleepCategoryId(data.id);
      });
  }, []);

  // Gentle pulse animation for tap area
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const currentDhikr = adhkar[currentIndex];
  const currentCount = currentDhikr ? counts[currentDhikr.id] || 0 : 0;
  const isCurrentDone = currentDhikr
    ? currentCount >= currentDhikr.repetition_count
    : false;

  const handleTap = () => {
    if (!currentDhikr || isCurrentDone) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newCount = currentCount + 1;
    setCounts((prev) => ({ ...prev, [currentDhikr.id]: newCount }));

    if (newCount >= currentDhikr.repetition_count) {
      // Auto-advance after a brief pause
      setTimeout(() => {
        if (currentIndex < adhkar.length - 1) {
          fadeTransition(() => setCurrentIndex(currentIndex + 1));
        } else {
          setAllDone(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }, 500);
    }
  };

  const fadeTransition = (callback: () => void) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      callback();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };

  if (allDone) {
    return (
      <View style={styles.doneContainer}>
        <Text style={styles.doneEmoji}>🌙</Text>
        <Text style={styles.doneTitle}>
          {isRTL ? "تصبح على خير" : "Good Night"}
        </Text>
        <Text style={styles.doneSubtitle}>
          {isRTL
            ? "أكملت أذكار النوم. نم بسلام 💤"
            : "You finished bedtime adhkar. Sleep well 💤"}
        </Text>
        <Pressable style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneBtnText}>
            {isRTL ? "العودة 🏠" : "Go Back 🏠"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Close button */}
      <Pressable style={styles.closeBtn} onPress={() => router.back()}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>

      {/* Moon & stars header */}
      <View style={styles.header}>
        <Text style={styles.moonEmoji}>🌙</Text>
        <Text style={styles.title}>{isRTL ? "وقت النوم" : "Bedtime Mode"}</Text>
        <Text style={styles.subtitle}>
          {isRTL
            ? "اقرأ أذكارك بهدوء قبل النوم"
            : "Read your adhkar softly before sleep"}
        </Text>
      </View>

      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {adhkar.map((_, i) => {
          const done = counts[adhkar[i].id] >= adhkar[i].repetition_count;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentIndex && styles.dotActive,
                done && styles.dotDone,
              ]}
            />
          );
        })}
      </View>

      {/* Dhikr card */}
      {currentDhikr && (
        <Animated.View style={[styles.dhikrCard, { opacity: fadeAnim }]}>
          <Pressable onPress={handleTap} style={styles.tapArea}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Text style={styles.arabicText}>{currentDhikr.text_ar}</Text>
            </Animated.View>

            {currentDhikr.meaning_ar && (
              <Text style={styles.meaning}>
                {isRTL
                  ? currentDhikr.meaning_ar
                  : currentDhikr.meaning_en || currentDhikr.meaning_ar}
              </Text>
            )}

            <View style={styles.counterRow}>
              <Text style={styles.counter}>
                {currentCount} / {currentDhikr.repetition_count}
              </Text>
            </View>

            {!isCurrentDone && (
              <Text style={styles.tapHint}>
                {isRTL ? "اضغط للعد" : "Tap to count"}
              </Text>
            )}
          </Pressable>
        </Animated.View>
      )}

      {loading && (
        <Text style={styles.loadingText}>
          {isRTL ? "جارٍ التحميل..." : "Loading..."}
        </Text>
      )}

      {!loading && adhkar.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>😴</Text>
          <Text style={styles.emptyText}>
            {isRTL
              ? "لا توجد أذكار نوم بعد"
              : "No bedtime adhkar available yet"}
          </Text>
        </View>
      )}

      {/* Navigation */}
      <View style={styles.navRow}>
        <Pressable
          onPress={() =>
            currentIndex > 0 &&
            fadeTransition(() => setCurrentIndex(currentIndex - 1))
          }
          disabled={currentIndex === 0}
          style={[styles.navBtn, currentIndex === 0 && { opacity: 0.3 }]}
        >
          <Text style={styles.navText}>{isRTL ? "التالي ←" : "← Prev"}</Text>
        </Pressable>
        <Text style={styles.navCount}>
          {currentIndex + 1} / {adhkar.length}
        </Text>
        <Pressable
          onPress={() => {
            if (currentIndex < adhkar.length - 1) {
              fadeTransition(() => setCurrentIndex(currentIndex + 1));
            }
          }}
          disabled={currentIndex >= adhkar.length - 1}
          style={[
            styles.navBtn,
            currentIndex >= adhkar.length - 1 && { opacity: 0.3 },
          ]}
        >
          <Text style={styles.navText}>{isRTL ? "→ السابق" : "Next →"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0820", // Darker for bedtime
    paddingTop: 60,
  },
  closeBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: COLORS.textSecondary, fontSize: 18 },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  moonEmoji: { fontSize: 48, marginBottom: 8 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#C7D2FE", // Soft indigo for night
    marginBottom: 4,
  },
  subtitle: { fontSize: 14, color: COLORS.textSecondary },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 20,
    paddingHorizontal: 20,
    flexWrap: "wrap",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  dotActive: { backgroundColor: "#818CF8", width: 20 },
  dotDone: { backgroundColor: COLORS.green },
  dhikrCard: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 24,
    backgroundColor: "rgba(99,102,241,0.08)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.2)",
  },
  tapArea: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  arabicText: {
    fontSize: 26,
    fontWeight: "600",
    color: "#E0E7FF",
    textAlign: "center",
    lineHeight: 48,
    marginBottom: 16,
  },
  meaning: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  counterRow: { marginBottom: 12 },
  counter: {
    fontSize: 20,
    fontWeight: "700",
    color: "#818CF8",
    textAlign: "center",
  },
  tapHint: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 8,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingBottom: 40,
  },
  navBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  navText: { color: "#818CF8", fontSize: 15, fontWeight: "600" },
  navCount: { color: COLORS.textMuted, fontSize: 14 },
  loadingText: {
    textAlign: "center",
    color: COLORS.textMuted,
    padding: 40,
  },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: COLORS.textMuted },
  doneContainer: {
    flex: 1,
    backgroundColor: "#0A0820",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  doneEmoji: { fontSize: 80, marginBottom: 16 },
  doneTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#C7D2FE",
    marginBottom: 8,
  },
  doneSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  doneBtn: {
    backgroundColor: "#4F46E5",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 16,
  },
  doneBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
