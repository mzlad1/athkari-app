import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { COLORS, GRADIENTS, resolveGradient } from "@/constants/theme";
import { useAdhkar } from "@/hooks/useAdhkar";
import { useVoiceFile } from "@/hooks/useVoiceFile";
import { Audio } from "expo-av";
import { activityService } from "@/services/activity";
import { badgeService } from "@/services/badges";
import { dailyGoalsService } from "@/services/daily-goals";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { useCategories } from "@/hooks/useCategories";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { T } from "@/constants/translations";
import { DhikrSkeleton } from "@/components/ui/Skeleton";
import { completedCategoriesService } from "@/services/completed-categories";
import { notificationService } from "@/services/notifications";
import { soundService } from "@/services/sounds";
import { getLevelFromStars } from "@/constants/levels";
import { CelebrationOverlay } from "@/components/gamification/CelebrationOverlay";
import type { CelebrationType } from "@/components/gamification/CelebrationOverlay";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");
const CIRCLE_SIZE = 200;

// ─── Overlay tokens (dark-glass on top of any category gradient) ──────────────
const G = {
  card: "rgba(0,0,0,0.38)",
  cardBorder: "rgba(255,255,255,0.15)",
  cardStrong: "rgba(0,0,0,0.52)",
  pill: "rgba(0,0,0,0.35)",
  pillBorder: "rgba(255,255,255,0.18)",
  white: "#FFFFFF",
  whiteHigh: "rgba(255,255,255,0.95)",
  whiteMid: "rgba(255,255,255,0.65)",
  whiteLow: "rgba(255,255,255,0.38)",
  gold: "#FFD60A",
  goldDim: "rgba(255,214,10,0.22)",
  goldBorder: "rgba(255,214,10,0.45)",
  mint: "#00F5A0",
  mintDim: "rgba(0,245,160,0.2)",
  mintBorder: "rgba(0,245,160,0.4)",
  cyan: "#00E5FF",
  cyanDim: "rgba(0,229,255,0.18)",
};

export default function DhikrScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const { adhkar, loading } = useAdhkar(
    categoryId ? parseInt(categoryId) : null,
  );
  const { categories } = useCategories();
  const { activeKid } = useAuth();
  const { lang, toggleLang } = useLang();
  const isRTL = lang === "ar";
  const t = T[lang];
  const kidId = activeKid?.id || null;
  const kidAvatar = activeKid?.avatar || activeKid?.avatar_emoji || "🌟";

  const category = categories.find((c) => c.id === parseInt(categoryId || "0"));
  const gradient = resolveGradient(category?.gradient);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [completedSet, setCompletedSet] = useState<Set<number>>(new Set());
  const [totalStars, setTotalStars] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [charMsg, setCharMsg] = useState("");
  const [anim, setAnim] = useState(false);
  const [progressLoaded, setProgressLoaded] = useState(false);

  const tapScale = useRef(new Animated.Value(1)).current;
  const starBounce = useRef(new Animated.Value(1)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;

  // ── Voice / Audio ──────────────────────────────────────────────
  const current = adhkar[currentIndex];
  // Priority: kid's preferred profile → adhkar's default profile
  const voiceProfileId =
    (activeKid as any)?.preferred_voice_profile_id ??
    (current as any)?.default_voice_profile_id ??
    null;
  const soundEnabled = (activeKid as any)?.sounds_enabled !== false;
  const { voiceFile } = useVoiceFile(current?.id, voiceProfileId);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const prevLevelRef = useRef(getLevelFromStars(0).level);

  // Sync sound effects toggle with service
  useEffect(() => {
    soundService.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Stop & unload audio when dhikr advances
  useEffect(() => {
    const cleanup = async () => {
      if (soundRef.current) {
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch {}
        soundRef.current = null;
      }
      setIsPlaying(false);
    };
    cleanup();
  }, [currentIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  const handleAudioPress = async () => {
    if (!voiceFile?.public_url) return;
    try {
      if (isPlaying && soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        return;
      }
      // Create new sound if needed
      if (!soundRef.current) {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: voiceFile.public_url },
          { shouldPlay: true },
        );
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
            soundRef.current = null;
          }
        });
      } else {
        await soundRef.current.playAsync();
      }
      setIsPlaying(true);
    } catch (e) {
      console.warn("Audio playback error:", e);
    }
  };

  // ── Progress persistence ──
  const progressKey =
    kidId && categoryId
      ? `dhikr_progress_${kidId}_${categoryId}_${new Date().toISOString().split("T")[0]}`
      : null;

  const saveProgress = useCallback(
    async (completed: Set<number>, index: number, stars: number) => {
      if (!progressKey) return;
      await AsyncStorage.setItem(
        progressKey,
        JSON.stringify({
          completedIds: [...completed],
          currentIndex: index,
          totalStars: stars,
        }),
      ).catch(() => {});
    },
    [progressKey],
  );

  const clearSavedProgress = useCallback(async () => {
    if (!progressKey) return;
    await AsyncStorage.removeItem(progressKey).catch(() => {});
  }, [progressKey]);

  useEffect(() => {
    if (!progressKey) {
      setProgressLoaded(true);
      return;
    }
    if (adhkar.length === 0) {
      if (!loading) setProgressLoaded(true);
      return;
    }
    AsyncStorage.getItem(progressKey)
      .then((raw) => {
        if (raw) {
          try {
            const saved = JSON.parse(raw);
            if (saved.completedIds?.length) {
              setCompletedSet(
                new Set(saved.completedIds.map((id: any) => Number(id))),
              );
              setTotalStars(saved.totalStars || 0);
              const savedSet = new Set(
                saved.completedIds.map((id: any) => Number(id)),
              );
              const resumeIdx = adhkar.findIndex((a) => !savedSet.has(a.id));
              if (resumeIdx !== -1) setCurrentIndex(resumeIdx);
              else setCurrentIndex(saved.currentIndex || 0);
            }
          } catch {}
        }
        setProgressLoaded(true);
      })
      .catch(() => setProgressLoaded(true));
  }, [progressKey, adhkar.length, loading]);

  const CHAR_MSGS = isRTL
    ? [
        "بسم الله نبدأ! 🤲",
        "أحسنت! 👏",
        "ما شاء الله! 🌟",
        "استمر! 💪",
        "ممتاز! 🎉",
      ]
    : [
        "Bismillah! 🤲",
        "Great job! 👏",
        "Masha Allah! 🌟",
        "Keep going! 💪",
        "Excellent! 🎉",
      ];

  const allDone = completedSet.size === adhkar.length && adhkar.length > 0;
  // current is already declared above (needed for useVoiceFile hook)
  const target = current?.repetition_count || 1;
  const isCurrentDone = current ? completedSet.has(current.id) : false;
  const progress = target > 0 ? Math.min(count / target, 1) : 0;

  const BEAD_COUNT = Math.min(target, 33);
  const completedBeads = Math.round(progress * BEAD_COUNT);

  useEffect(() => {
    if (current && !completedSet.has(current.id)) setCount(0);
    else if (current) setCount(target);
  }, [currentIndex]);

  useEffect(() => {
    if (adhkar.length > 0 && !completedSet.has(adhkar[0]?.id)) {
      showCharMsg(CHAR_MSGS[0]);
    }
  }, [adhkar.length]);

  const showCharMsg = (msg: string) => {
    setCharMsg(msg);
    bubbleOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(bubbleOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(2200),
      Animated.timing(bubbleOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setCharMsg(""));
  };

  const animateTap = () => {
    Animated.sequence([
      Animated.spring(tapScale, {
        toValue: 0.91,
        useNativeDriver: true,
        speed: 80,
        bounciness: 2,
      }),
      Animated.spring(tapScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 8,
      }),
    ]).start();
  };

  const animateStar = () => {
    Animated.sequence([
      Animated.spring(starBounce, {
        toValue: 1.4,
        useNativeDriver: true,
        speed: 60,
      }),
      Animated.spring(starBounce, {
        toValue: 1,
        useNativeDriver: true,
        speed: 40,
      }),
    ]).start();
  };

  const handleTap = async () => {
    if (!current || isCurrentDone) return;

    const newCount = count + 1;
    setCount(newCount);
    animateTap();

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    soundService.play("tap");

    if (newCount % 3 === 0 || newCount === 1) {
      showCharMsg(CHAR_MSGS[Math.floor(Math.random() * CHAR_MSGS.length)]);
    }

    if (newCount >= target) {
      const points = current.points || 5;
      const newTotalStars = totalStars + points;
      setTotalStars(newTotalStars);
      animateStar();
      const newCompleted = new Set([...completedSet, current.id]);
      setCompletedSet(newCompleted);

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      soundService.play("dhikr_complete");

      // Level-up detection
      const newLevel = getLevelFromStars(newTotalStars).level;
      if (newLevel > prevLevelRef.current) {
        prevLevelRef.current = newLevel;
        soundService.play("level_up");
      }

      if (kidId) {
        activityService
          .logDhikrComplete(kidId, current.id, parseInt(categoryId!), target)
          .then(() => {
            badgeService
              .evaluateBadges(kidId)
              .then((result: any) => {
                // Play badge sound if new badges were earned
                if (result?.newBadges?.length || result?.length) {
                  soundService.play("badge_unlock");
                }
              })
              .catch(() => {});
            dailyGoalsService
              .incrementProgress(kidId)
              .then((result: any) => {
                if (result?.goalComplete) {
                  soundService.play("daily_goal");
                }
              })
              .catch(() => {});
          })
          .catch((e) => console.error("Activity log failed:", e));
      }

      if (newCompleted.size === adhkar.length) {
        clearSavedProgress();
        soundService.play("category_complete");
        if (kidId) {
          completedCategoriesService
            .markCompleted(kidId, parseInt(categoryId!))
            .catch(() => {});
          const catName = category
            ? { ar: category.title_ar, en: category.title_en }
            : { ar: "القسم", en: "Category" };
          notificationService
            .insertInAppNotification({
              toKidId: kidId,
              type: "category_complete",
              titleAr: `✅ أكملت ${catName.ar}!`,
              titleEn: `✅ ${catName.en} Complete!`,
              bodyAr: `أحسنت! أتممت جميع أذكار ${catName.ar}. 🎉`,
              bodyEn: `Well done! You finished all adhkar in ${catName.en}. 🎉`,
              data: { category_id: parseInt(categoryId!) },
            })
            .catch(() => {});
        }
        setShowCelebration(true);
      } else {
        saveProgress(newCompleted, currentIndex, newTotalStars);
        setTimeout(() => {
          const nextIdx = adhkar.findIndex(
            (a, i) => i > currentIndex && !newCompleted.has(a.id),
          );
          if (nextIdx !== -1) setCurrentIndex(nextIdx);
        }, 600);
      }
    }
  };

  const goHome = () => router.back();

  if (loading || !progressLoaded) {
    return (
      <LinearGradient
        colors={gradient as [string, string, ...string[]]}
        style={styles.loadingContainer}
      >
        <View style={styles.loadingOverlay}>
          <DhikrSkeleton />
        </View>
      </LinearGradient>
    );
  }

  if (!current && !allDone) {
    return (
      <LinearGradient
        colors={gradient as [string, string, ...string[]]}
        style={styles.loadingContainer}
      >
        <Text style={styles.loadingText}>
          {isRTL ? "لا توجد أذكار" : "No adhkar found"}
        </Text>
        <Pressable style={styles.backBtnFull} onPress={goHome}>
          <Text style={styles.backBtnText}>{isRTL ? "العودة" : "Back"}</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={gradient as [string, string, ...string[]]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Dark overlay to deepen the gradient for glass UI contrast */}
      <View style={styles.darkOverlay} />

      {showCelebration && (
        <CelebrationOverlay
          type={
            ((category as any)?.celebration_type as CelebrationType) ||
            "confetti"
          }
          title={
            isRTL
              ? `أحسنت يا ${activeKid?.display_name || "بطل"}!`
              : `Well done, ${activeKid?.display_name || "Champ"}!`
          }
          subtitle={isRTL ? category?.title_ar : category?.title_en}
          stars={totalStars}
          isRTL={isRTL}
          autoDismissMs={3200}
          onDismiss={() => {
            setShowCelebration(false);
            router.back();
          }}
        />
      )}

      {/* ━━━ HEADER ━━━ */}
      <View style={styles.header}>
        <Pressable onPress={goHome} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>←</Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.catLabel}>
            {isRTL ? category?.title_ar : category?.title_en}
          </Text>
          {/* Progress dots */}
          <View style={styles.progressPillWrap}>
            {adhkar.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i < completedSet.size && styles.progressDotDone,
                  i === currentIndex &&
                    !completedSet.has(adhkar[i]?.id) &&
                    styles.progressDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Stars badge (top right) */}
        <Animated.View style={{ transform: [{ scale: starBounce }] }}>
          <LinearGradient
            colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0.35)"]}
            style={styles.starsBadge}
          >
            <Text style={styles.starsBadgeText}>⭐ {totalStars}</Text>
          </LinearGradient>
        </Animated.View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ━━━ DHIKR CARD ━━━ */}
        {current && (
          <View style={styles.dhikrCard}>
            {/* Top row */}
            <View style={styles.dhikrCardTopRow}>
              <View style={styles.dhikrIndexBadge}>
                <Text style={styles.dhikrIndexText}>
                  {currentIndex + 1}/{adhkar.length}
                </Text>
              </View>
              {isCurrentDone && (
                <View style={styles.dhikrDonePill}>
                  <Text style={styles.dhikrDoneText}>
                    ✅ {isRTL ? "مكتمل" : "Done"}
                  </Text>
                </View>
              )}
            </View>

            {/* Arabic text */}
            <Text style={styles.arabicText}>{current.text_ar}</Text>

            {/* Meaning */}
            {current.meaning_ar && (
              <Text style={styles.meaningText}>
                {isRTL
                  ? current.meaning_ar
                  : current.meaning_en || current.meaning_ar}
              </Text>
            )}

            {/* Repetition / points */}
            <View style={styles.repetitionRow}>
              <View style={styles.repCountPill}>
                <Text style={styles.repetitionLabel}>× {target}</Text>
              </View>
              <View style={styles.repPointsPill}>
                <Text style={styles.repetitionPoints}>
                  +{current.points || 5} ⭐
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ━━━ TAP CIRCLE ━━━ */}
        <View style={styles.circleArea}>
          {/* Outer soft glow */}
          <View style={styles.circleGlow} />

          {/* Bead track */}
          <View style={styles.beadTrack}>
            {Array.from({ length: BEAD_COUNT }).map((_, i) => (
              <View
                key={i}
                style={[styles.bead, i < completedBeads && styles.beadDone]}
              />
            ))}
          </View>

          <Animated.View
            style={[styles.tapCircleWrap, { transform: [{ scale: tapScale }] }]}
          >
            <Pressable
              onPress={handleTap}
              style={[styles.tapCircle, isCurrentDone && styles.tapCircleDone]}
            >
              {/* Dashed inner ring progress indicator */}
              <View
                style={[
                  styles.innerRing,
                  {
                    opacity: 0.15 + progress * 0.75,
                    borderColor: isCurrentDone ? G.mint : G.gold,
                  },
                ]}
              />

              {isCurrentDone ? (
                <Text style={styles.tapDoneEmoji}>✅</Text>
              ) : (
                <>
                  <Text style={styles.tapCount}>{count}</Text>
                  <Text style={styles.tapOf}>/{target}</Text>
                  <Text style={styles.tapHint}>{isRTL ? "اضغط" : t.tap}</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        </View>

        {/* ━━━ CHARACTER BUBBLE ━━━ */}
        {charMsg ? (
          <Animated.View
            style={[styles.charBubble, { opacity: bubbleOpacity }]}
          >
            <View style={styles.charAvatarWrap}>
              <Text style={styles.charAvatar}>{kidAvatar}</Text>
            </View>
            <View style={styles.charSpeech}>
              <Text style={styles.charText}>{charMsg}</Text>
            </View>
          </Animated.View>
        ) : (
          <View style={styles.charBubblePlaceholder} />
        )}

        {/* ━━━ MINI PROGRESS BAR ━━━ */}
        <View style={styles.miniProgressWrap}>
          <View style={styles.miniProgressBg}>
            <LinearGradient
              colors={[G.gold, "rgba(255,214,10,0.6)"]}
              style={[
                styles.miniProgressFill,
                { width: `${progress * 100}%` as any },
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
          <Text style={styles.miniProgressText}>
            {Math.round(progress * 100)}%
          </Text>
        </View>

        {/* ━━━ AUDIO ━━━ */}
        {soundEnabled && voiceFile ? (
          <Pressable style={styles.audioBtn} onPress={handleAudioPress}>
            <Text style={styles.audioIcon}>{isPlaying ? "⏸" : "🔊"}</Text>
            <Text style={styles.audioText}>
              {isPlaying
                ? isRTL ? "إيقاف" : "Pause"
                : isRTL ? "استمع" : t.listen}
            </Text>
          </Pressable>
        ) : null}

        {/* ━━━ NAV DOTS ━━━ */}
        {adhkar.length > 1 && (
          <View style={styles.navRow}>
            {adhkar.map((a, i) => {
              const done = completedSet.has(a.id);
              const active = i === currentIndex;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    if (done || i <= currentIndex) setCurrentIndex(i);
                  }}
                  style={[
                    styles.navDot,
                    done && styles.navDotDone,
                    active && styles.navDotActive,
                  ]}
                >
                  {done && (
                    <Text style={{ fontSize: 8, color: "#060B27" }}>✓</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Dark overlay — makes category gradients darker so glass cards pop
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
    zIndex: 0,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: G.white, fontSize: 16, fontWeight: "700" },
  backBtnFull: {
    marginTop: 16,
    backgroundColor: G.card,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: G.cardBorder,
  },
  backBtnText: { color: G.white, fontSize: 14, fontWeight: "700" },

  // ── Header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    zIndex: 1,
  },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: G.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: G.cardBorder,
  },
  headerBtnText: { color: G.white, fontSize: 16, fontWeight: "800" },
  headerCenter: {
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginHorizontal: 10,
  },
  catLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: G.whiteHigh,
    textAlign: "center",
  },
  progressPillWrap: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
    maxWidth: 180,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: G.whiteLow,
  },
  progressDotDone: { backgroundColor: G.gold },
  progressDotActive: {
    backgroundColor: G.white,
    width: 11,
    height: 11,
    borderRadius: 5.5,
  },

  // ── Stars badge (in header) ──
  starsBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: G.goldBorder,
    shadowColor: G.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  starsBadgeText: { fontSize: 13, fontWeight: "900", color: G.gold },

  // ── Content ──
  content: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 4,
    zIndex: 1,
  },

  // ── Dhikr card ──
  dhikrCard: {
    width: "100%",
    backgroundColor: G.card,
    borderRadius: 26,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: G.cardBorder,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  dhikrCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 12,
  },
  dhikrIndexBadge: {
    backgroundColor: G.pill,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: G.pillBorder,
  },
  dhikrIndexText: {
    fontSize: 11,
    fontWeight: "800",
    color: G.whiteMid,
  },
  dhikrDonePill: {
    backgroundColor: G.mintDim,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: G.mintBorder,
  },
  dhikrDoneText: { fontSize: 11, fontWeight: "800", color: G.mint },
  arabicText: {
    fontSize: 24,
    fontWeight: "900",
    color: G.white,
    lineHeight: 46,
    textAlign: "center",
  },
  meaningText: {
    fontSize: 13,
    color: G.whiteMid,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  repetitionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
    gap: 8,
  },
  repCountPill: {
    backgroundColor: G.goldDim,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: G.goldBorder,
  },
  repetitionLabel: { fontSize: 14, fontWeight: "900", color: G.gold },
  repPointsPill: {
    backgroundColor: G.pill,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: G.pillBorder,
  },
  repetitionPoints: {
    fontSize: 13,
    fontWeight: "800",
    color: G.whiteMid,
  },

  // ── Tap circle ──
  circleArea: {
    width: CIRCLE_SIZE + 64,
    height: CIRCLE_SIZE + 64,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  circleGlow: {
    position: "absolute",
    width: CIRCLE_SIZE + 50,
    height: CIRCLE_SIZE + 50,
    borderRadius: (CIRCLE_SIZE + 50) / 2,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  beadTrack: {
    position: "absolute",
    width: CIRCLE_SIZE + 60,
    height: CIRCLE_SIZE + 60,
    borderRadius: (CIRCLE_SIZE + 60) / 2,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    padding: 4,
  },
  bead: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  beadDone: { backgroundColor: G.gold },
  tapCircleWrap: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 18,
  },
  tapCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: G.cardStrong,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  tapCircleDone: {
    backgroundColor: G.mintDim,
    borderColor: G.mint,
    borderWidth: 3,
  },
  innerRing: {
    position: "absolute",
    width: CIRCLE_SIZE - 22,
    height: CIRCLE_SIZE - 22,
    borderRadius: (CIRCLE_SIZE - 22) / 2,
    borderWidth: 2.5,
    borderStyle: "dashed",
  },
  tapDoneEmoji: { fontSize: 56 },
  tapCount: {
    fontSize: 56,
    fontWeight: "900",
    color: G.white,
    lineHeight: 64,
  },
  tapOf: {
    fontSize: 16,
    fontWeight: "800",
    color: G.whiteMid,
    marginTop: -4,
  },
  tapHint: {
    fontSize: 11,
    fontWeight: "700",
    color: G.whiteLow,
    marginTop: 2,
  },

  // ── Character bubble ──
  charBubble: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 10,
    width: "100%",
    paddingHorizontal: 6,
  },
  charBubblePlaceholder: { height: 52, marginBottom: 10 },
  charAvatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: G.card,
    borderWidth: 1,
    borderColor: G.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  charAvatar: { fontSize: 22 },
  charSpeech: {
    backgroundColor: G.card,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: width - 120,
    borderWidth: 1,
    borderColor: G.cardBorder,
  },
  charText: { fontSize: 13, fontWeight: "700", color: G.whiteHigh },

  // ── Mini progress bar ──
  miniProgressWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    marginBottom: 12,
  },
  miniProgressBg: {
    flex: 1,
    height: 9,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    overflow: "hidden",
  },
  miniProgressFill: { height: "100%", borderRadius: 20 },
  miniProgressText: {
    fontSize: 11,
    fontWeight: "800",
    color: G.gold,
    width: 34,
    textAlign: "right",
  },

  // ── Audio ──
  audioBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: G.card,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: G.cardBorder,
  },
  audioIcon: { fontSize: 18, color: G.white },
  audioText: { fontSize: 13, fontWeight: "700", color: G.whiteHigh },
  noAudio: {
    fontSize: 12,
    color: G.whiteLow,
    textAlign: "center",
    marginBottom: 14,
    fontWeight: "600",
  },

  // ── Nav dots ──
  navRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  navDot: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: G.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: G.cardBorder,
  },
  navDotDone: {
    backgroundColor: G.gold,
    borderColor: G.gold,
  },
  navDotActive: {
    borderColor: G.white,
    borderWidth: 2.5,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
});
