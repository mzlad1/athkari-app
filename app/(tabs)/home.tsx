import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  Modal,
  Dimensions,
  Animated,
  Image,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useState, useCallback, useEffect, useRef } from "react";
import { COLORS, GRADIENTS, resolveGradient } from "@/constants/theme";
import { useCategories } from "@/hooks/useCategories";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { useDailyGoal } from "@/hooks/useDailyGoal";
import { useKidStats } from "@/hooks/useKidStats";
import { useChallenges } from "@/hooks/useChallenges";
import { useStreak } from "@/hooks/useStreak";
import { getStreakMessage } from "@/hooks/useStreak";
import { useWird, useSeasonalWird } from "@/hooks/useWird";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { supabase } from "@/services/supabase";
import { activityService } from "@/services/activity";
import { badgeService } from "@/services/badges";
import { dailyGoalsService } from "@/services/daily-goals";
import { notificationService } from "@/services/notifications";
import { challengesService } from "@/services/challenges";
import { useFriends } from "@/hooks/useFriends";
import { LinearGradient } from "expo-linear-gradient";
import { T } from "@/constants/translations";
import { HomeSkeleton, WirdSkeleton } from "@/components/ui/Skeleton";
import { ConfirmModal } from "@/components/ui";
import type { ConfirmConfig } from "@/components/ui";
import { CelebrationOverlay } from "@/components/gamification/CelebrationOverlay";
import type { CelebrationType } from "@/components/gamification/CelebrationOverlay";
import { LevelRoad } from "@/components/gamification/LevelRoad";
import { soundService } from "@/services/sounds";
import { LevelUpCelebration } from "@/components/gamification/LevelUpCelebration";
import { useLevel } from "@/hooks/useLevel";
import { getLevelFromStars } from "@/constants/levels";

const { width } = Dimensions.get("window");
const CAT_CARD_SIZE = (width - 40 - 16) / 3;

// ─── Design Tokens ───────────────────────────────────────────────────────────
const C = {
  bg: "#06091E",
  bgCard: "rgba(255,255,255,0.05)",
  bgCardBorder: "rgba(255,255,255,0.09)",
  cyan: "#00E5FF",
  cyanDim: "rgba(0,229,255,0.15)",
  cyanBorder: "rgba(0,229,255,0.3)",
  gold: "#FFD60A",
  goldDim: "rgba(255,214,10,0.15)",
  goldBorder: "rgba(255,214,10,0.3)",
  coral: "#FF6B9D",
  coralDim: "rgba(255,107,157,0.15)",
  coralBorder: "rgba(255,107,157,0.3)",
  mint: "#00F5A0",
  mintDim: "rgba(0,245,160,0.12)",
  mintBorder: "rgba(0,245,160,0.25)",
  lavender: "#B388FF",
  lavDim: "rgba(179,136,255,0.12)",
  lavBorder: "rgba(179,136,255,0.3)",
  sky: "#40C4FF",
  white: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.4)",
  textSub: "rgba(255,255,255,0.6)",
};

export default function HomeScreen() {
  const { categories, loading: catLoading } = useCategories();
  const { activeKid, logout } = useAuth();
  const { lang, toggleLang } = useLang();
  const isRTL = lang === "ar";
  const t = T[lang];
  const kidId = activeKid?.id ?? undefined;

  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const [showWirdCelebration, setShowWirdCelebration] = useState(false);
  const [showSeasonalCelebration, setShowSeasonalCelebration] = useState(false);

  const {
    goal,
    completed: goalProgress,
    target: goalTarget,
    isComplete: goalDone,
    loading: goalLoading,
    refresh: refreshGoal,
  } = useDailyGoal(kidId);
  const {
    stats,
    loading: statsLoading,
    refresh: refreshStats,
  } = useKidStats(kidId);
  const { challenges, refresh: refreshChallenges } = useChallenges();
  const {
    streak: streakCount,
    isNewMilestone,
    milestoneType,
    checkStreak,
    dismissMilestone,
  } = useStreak();
  const {
    items: wirdItems,
    template: wirdTemplate,
    isComplete: wirdComplete,
    loading: wirdLoading,
    refresh: refreshWird,
    markItemDone: markWirdDone,
    markComplete: markWirdComplete,
    clearPendingWrite,
  } = useWird(kidId ?? null);

  const {
    items: seasonalItems,
    template: seasonalTemplate,
    isComplete: seasonalComplete,
    showSeasonal,
    loading: seasonalLoading,
    refresh: refreshSeasonalWird,
    markItemDone: markSeasonalDone,
    markComplete: markSeasonalComplete,
    clearPendingWrite: clearSeasonalPendingWrite,
  } = useSeasonalWird(kidId ?? null);
  const { friends } = useFriends(kidId);
  const flags = useFeatureFlags();
  const [refreshing, setRefreshing] = useState(false);
  const [showChallOverlay, setShowChallOverlay] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showLevelRoad, setShowLevelRoad] = useState(false);
  const [weekCompletions, setWeekCompletions] = useState<
    Record<string, boolean>
  >({});

  const wirdScales = useRef<{ [key: string]: Animated.Value }>({}).current;
  const getWirdScale = (id: string | number) => {
    const key = String(id);
    if (!wirdScales[key]) wirdScales[key] = new Animated.Value(1);
    return wirdScales[key];
  };

  // Spinning ring animation for avatar
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 12000,
        useNativeDriver: true,
      }),
    ).start();
  }, []);
  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const activeCommunity = (challenges || []).filter(
    (c: any) => c.status === "active" && c.type !== "1v1",
  );
  const recentlyCompletedCommunity = (challenges || []).filter(
    (c: any) => c.status === "completed" && c.type !== "1v1",
  );

  const fetchWeekCompletions = useCallback(async () => {
    if (!kidId) return;
    const now = new Date();
    const dayOfWeek = now.getDay();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - dayOfWeek);
    const startDate = sunday.toISOString().split("T")[0];
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    const endDate = saturday.toISOString().split("T")[0];

    const { data } = await supabase
      .from("wird_logs")
      .select("log_date, is_complete")
      .eq("kid_id", kidId)
      .gte("log_date", startDate)
      .lte("log_date", endDate);

    const map: Record<string, boolean> = {};
    (data || []).forEach((row: any) => {
      map[row.log_date] = row.is_complete === true;
    });
    setWeekCompletions(map);
  }, [kidId]);

  useEffect(() => {
    checkStreak();
    fetchWeekCompletions();
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshStats();
      refreshGoal();
      fetchWeekCompletions();
      if (kidId)
        notificationService
          .getUnreadCount(kidId)
          .then(setUnreadCount)
          .catch(() => {});
    }, [refreshStats, refreshGoal, fetchWeekCompletions, kidId]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refreshStats(),
      refreshGoal(),
      checkStreak(),
      refreshWird(),
      refreshSeasonalWird(),
      fetchWeekCompletions(),
    ]);
    setRefreshing(false);
  }, [refreshStats, refreshGoal, checkStreak, refreshWird]);

  const kidName = activeKid?.name || (isRTL ? "بطل" : "Champ");
  const kidAvatar = activeKid?.avatar || activeKid?.avatar_emoji || "🌟";

  const totalStars = stats?.stars || 0;
  const streak = streakCount || stats?.streak || 0;

  const {
    level: currentLevel,
    progress: levelProg,
    justLeveledUp,
    newLevel,
    dismissLevelUp,
  } = useLevel(kidId, totalStars);

  const handleWirdToggle = async (item: any) => {
    if (item.is_completed || !kidId) return;
    const scale = getWirdScale(item.id);
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1.15,
        useNativeDriver: true,
        speed: 50,
      }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }),
    ]).start();
    const wasLastItem = wirdItems.filter((i) => !i.is_completed).length === 1;
    markWirdDone(item.id);
    if (wasLastItem) markWirdComplete();
    activityService
      .completeWirdItem(kidId, item.id)
      .then(() => {
        clearPendingWrite();
        badgeService.evaluateBadges(kidId).catch(() => {});
        dailyGoalsService.incrementProgress(kidId).catch(() => {});
        refreshGoal();
        if (wasLastItem) {
          activityService
            .completeWird(kidId, wirdTemplate?.reward_stars)
            .then(() => {
              refreshStats();
              checkStreak();
              fetchWeekCompletions();
            })
            .catch(() => {});
          setShowWirdCelebration(true);
        }
      })
      .catch(() => {
        clearPendingWrite();
        refreshWird();
      });
  };

  const wirdDoneCount = wirdItems.filter((i) => i.is_completed).length;

  const handleSeasonalWirdToggle = async (item: any) => {
    if (item.is_completed || !kidId) return;
    soundService.play("tap");
    const scale = getWirdScale(`s_${item.id}`);
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1.15,
        useNativeDriver: true,
        speed: 50,
      }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }),
    ]).start();
    const wasLastItem =
      seasonalItems.filter((i: any) => !i.is_completed).length === 1;
    markSeasonalDone(item.id);
    if (wasLastItem) markSeasonalComplete();
    activityService
      .completeSeasonalWirdItem(kidId, item.id)
      .then(() => {
        clearSeasonalPendingWrite();
        dailyGoalsService.incrementProgress(kidId).catch(() => {});
        refreshGoal();
        if (wasLastItem) {
          activityService
            .completeSeasonalWird(kidId, seasonalTemplate?.reward_stars)
            .then(() => {
              refreshStats();
              soundService.play("seasonal_wird");
              setShowSeasonalCelebration(true);
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        clearSeasonalPendingWrite();
        refreshSeasonalWird();
      });
  };

  const seasonalDoneCount = seasonalItems.filter(
    (i: any) => i.is_completed,
  ).length;

  const goalPct =
    goalTarget > 0 ? Math.min((goalProgress / goalTarget) * 100, 100) : 0;

  const weekLabels = isRTL
    ? ["ح", "ن", "ث", "ر", "خ", "ج", "س"]
    : ["S", "M", "T", "W", "T", "F", "S"];

  const streakDays = (() => {
    const now = new Date();
    const todayIndex = now.getDay();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - todayIndex);
    return weekLabels.map((label, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const isToday = i === todayIndex;
      const isPast = i < todayIndex;
      const done = weekCompletions[dateStr] === true;
      const missed = isPast && !done;
      return { label, done, missed, isToday };
    });
  })();

  if (catLoading && goalLoading && statsLoading) {
    return (
      <ScrollView style={styles.container}>
        <HomeSkeleton />
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ConfirmModal config={confirm} onClose={() => setConfirm(null)} />

      {justLeveledUp && newLevel && (
        <LevelUpCelebration
          level={newLevel}
          onDismiss={dismissLevelUp}
          isRTL={isRTL}
        />
      )}
      {showWirdCelebration && (
        <CelebrationOverlay
          type={
            (wirdTemplate?.celebration_type as CelebrationType) || "confetti"
          }
          title={isRTL ? "🎉 أكملت وردك!" : "🎉 Wird Complete!"}
          subtitle={isRTL ? wirdTemplate?.name_ar : wirdTemplate?.name_en}
          stars={wirdTemplate?.reward_stars || 50}
          isRTL={isRTL}
          autoDismissMs={3500}
          onDismiss={() => setShowWirdCelebration(false)}
        />
      )}
      {showSeasonalCelebration && (
        <CelebrationOverlay
          type={
            (seasonalTemplate?.celebration_type as CelebrationType) ||
            "confetti"
          }
          title={isRTL ? t.seasonalWirdComplete : t.seasonalWirdComplete}
          subtitle={
            isRTL ? seasonalTemplate?.name_ar : seasonalTemplate?.name_en
          }
          stars={seasonalTemplate?.reward_stars || 50}
          isRTL={isRTL}
          autoDismissMs={3500}
          onDismiss={() => setShowSeasonalCelebration(false)}
        />
      )}

      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.cyan}
          />
        }
      >
        {/* ══════════════════════════════════════════
            HEADER
        ══════════════════════════════════════════ */}
        <LinearGradient
          colors={["#0D1040", "#060918"]}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Ambient glow blobs */}
          <View style={styles.blobCyan} />
          <View style={styles.blobCoral} />

          {/* Decorative stars */}
          {[
            { top: 18, left: 30, size: 3 },
            { top: 45, left: 120, size: 2 },
            { top: 20, right: 80, size: 2.5 },
            { top: 60, right: 150, size: 2 },
            { top: 35, left: 200, size: 2 },
          ].map((s, i) => (
            <View
              key={i}
              style={[
                styles.starDot,
                {
                  top: s.top,
                  left: (s as any).left,
                  right: (s as any).right,
                  width: s.size,
                  height: s.size,
                },
              ]}
            />
          ))}

          {/* ── Top row: app label + action buttons ── */}
          <View style={styles.headerTopRow}>
            <Text style={styles.appLabel}>✨ {t.appName}</Text>

            <View style={styles.headerActions}>
              <Pressable style={styles.langChip} onPress={toggleLang}>
                <Text style={styles.langChipText}>🌍 {t.lang}</Text>
              </Pressable>
              <Pressable
                style={styles.iconChip}
                onPress={() => {
                  soundService.play("tab_press");
                  router.push("/notifications");
                }}
              >
                <Text style={{ fontSize: 17 }}>🔔</Text>
                {unreadCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                style={[styles.iconChip, styles.logoutChip]}
                onPress={() => {
                  soundService.play("tab_press");
                  setConfirm({
                    title: isRTL ? "تسجيل الخروج" : "Logout",
                    message: isRTL ? "هل تريد تسجيل الخروج؟" : "Are you sure?",
                    confirmText: isRTL ? "خروج" : "Logout",
                    cancelText: isRTL ? "إلغاء" : "Cancel",
                    destructive: true,
                    onConfirm: () => logout(),
                  });
                }}
              >
                <Text style={{ fontSize: 17 }}>🚪</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Bottom row: avatar + name + pills ── */}
          <View style={styles.headerBottomRow}>
            <Pressable
              onPress={() => setShowLevelRoad(true)}
              style={({ pressed }) => [
                { transform: [{ scale: pressed ? 0.92 : 1 }] },
              ]}
            >
              <View style={styles.avatarOuter}>
                <Animated.View
                  style={[
                    styles.avatarRing,
                    { transform: [{ rotate: spinInterpolate }] },
                  ]}
                />
                <View style={styles.avatarInner}>
                  {activeKid?.avatar_url ? (
                    <Image
                      source={{ uri: activeKid.avatar_url }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Text style={styles.avatarEmoji}>{kidAvatar}</Text>
                  )}
                </View>
                <Pressable
                  style={styles.avatarEditBadge}
                  onPress={() => router.push("/edit-profile")}
                  hitSlop={8}
                >
                  <Text style={styles.avatarEditIcon}>✏️</Text>
                </Pressable>
                <LinearGradient
                  colors={[C.gold, "#FF9100"]}
                  style={styles.lvlBadge}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.lvlBadgeText}>
                    ⚡ {currentLevel.level}
                  </Text>
                </LinearGradient>
              </View>
            </Pressable>

            <View style={styles.headerInfo}>
              <Text style={styles.greetingText} numberOfLines={1}>
                {t.hi} {kidName} 👋
              </Text>
              <View style={styles.headerPills}>
                <View style={styles.goldPill}>
                  <Text style={styles.goldPillText}>⭐ {totalStars}</Text>
                </View>
                <View style={styles.cyanPill}>
                  <Text style={styles.cyanPillText}>🔥 {streak}</Text>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ══════════════════════════════════════════
            STREAK CARD
        ══════════════════════════════════════════ */}
        <LinearGradient
          colors={["#1A0A3A", "#2D1050"]}
          style={styles.streakCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Decorative watermark */}
          <Text style={styles.streakWatermark}>🔥</Text>

          {/* Fire + count */}
          <View style={styles.streakLeft}>
            <Text style={styles.streakFireEmoji}>🔥</Text>
            <Text style={styles.streakNum}>{streak}</Text>
            <Text style={styles.streakDaysWord}>{isRTL ? "يوم" : "Days"}</Text>
          </View>

          {/* Divider */}
          <View style={styles.streakDivider} />

          {/* Right: message + week dots */}
          <View style={{ flex: 1 }}>
            <Text style={styles.streakTitle}>
              {isRTL ? "🔥 سلسلة رائعة!" : "🔥 Hot Streak!"}
            </Text>
            <Text style={styles.streakSub}>
              {isRTL ? "واصل التقدم!" : "Keep the flame alive!"}
            </Text>
            <View style={styles.weekRow}>
              {streakDays.map((d, i) => (
                <View
                  key={i}
                  style={[
                    styles.weekDot,
                    d.done && styles.weekDotDone,
                    d.missed && styles.weekDotMissed,
                    d.isToday && styles.weekDotToday,
                  ]}
                >
                  <Text
                    style={[
                      styles.weekDotText,
                      d.done && styles.weekDotTextDone,
                      d.missed && styles.weekDotTextMissed,
                    ]}
                  >
                    {d.done ? "✓" : d.missed ? "✗" : d.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </LinearGradient>

        {/* ══════════════════════════════════════════
            DAILY WIRD
        ══════════════════════════════════════════ */}
        {flags.wird && (
          <>
            <Text style={[styles.sectionTitle]}>{t.wirdTitle}</Text>

            {wirdLoading ? (
              <WirdSkeleton />
            ) : (
              wirdItems.length > 0 && (
                <LinearGradient
                  colors={
                    wirdComplete
                      ? ["#003D28", "#005A3C"]
                      : ["#003D28", "#005A3C"]
                  }
                  style={styles.wirdCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.wirdWatermark}>📿</Text>
                  <View style={styles.wirdHeader}>
                    <Text style={styles.wirdTitle}>
                      ☁️ {isRTL ? "ذكر اليوم" : "Today's Dhikr"}
                    </Text>
                    <View style={styles.wirdCountBadge}>
                      <Text style={styles.wirdCountText}>
                        {wirdDoneCount}/{wirdItems.length}
                      </Text>
                    </View>
                  </View>

                  {/* Wird progress bar */}
                  <View style={styles.wirdProgressBg}>
                    <View
                      style={[
                        styles.wirdProgressFill,
                        {
                          width: `${
                            wirdItems.length > 0
                              ? (wirdDoneCount / wirdItems.length) * 100
                              : 0
                          }%` as any,
                        },
                      ]}
                    />
                  </View>

                  {wirdItems.map((item, i) => {
                    const done = item.is_completed;
                    return (
                      <Animated.View
                        key={item.id || i}
                        style={{
                          transform: [{ scale: getWirdScale(item.id) }],
                        }}
                      >
                        <Pressable
                          onPress={() => handleWirdToggle(item)}
                          style={[styles.wirdItem, done && styles.wirdItemDone]}
                        >
                          <View
                            style={[
                              styles.wirdCheckbox,
                              done && styles.wirdCheckboxDone,
                            ]}
                          >
                            {done && (
                              <Text style={styles.wirdCheckmark}>✓</Text>
                            )}
                          </View>
                          <Text
                            style={[
                              styles.wirdItemLabel,
                              done && styles.wirdItemLabelDone,
                            ]}
                          >
                            {isRTL
                              ? item.text_ar
                              : item.meaning_en || item.text_ar}
                          </Text>
                          {done && <Text style={{ fontSize: 14 }}>⭐</Text>}
                        </Pressable>
                      </Animated.View>
                    );
                  })}

                  {wirdComplete ? (
                    <View style={styles.wirdCompleteRow}>
                      <Text style={styles.wirdCompleteText}>
                        {t.wirdComplete}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.wirdRewardHint}>
                      {isRTL
                        ? `أكمل جميع الأذكار للحصول على ${wirdTemplate?.reward_stars || 50} ⭐`
                        : `Complete all to earn ${wirdTemplate?.reward_stars || 50} ⭐`}
                    </Text>
                  )}
                </LinearGradient>
              )
            )}
          </>
        )}

        {/* ══════════════════════════════════════════
            SEASONAL WIRD
        ══════════════════════════════════════════ */}
        {flags.wird &&
          showSeasonal &&
          !seasonalLoading &&
          seasonalTemplate &&
          seasonalItems.length > 0 && (
            <>
              <Text style={[styles.sectionTitle]}>{t.seasonalWirdTitle}</Text>
              <LinearGradient
                colors={[
                  seasonalTemplate?.seasonal_card_color_from || "#1A0533",
                  seasonalTemplate?.seasonal_card_color_to || "#2D0A52",
                ]}
                style={styles.wirdCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.wirdWatermark}>
                  {seasonalTemplate?.seasonal_card_icon || "🌙"}
                </Text>
                <View style={styles.wirdHeader}>
                  <Text style={styles.wirdTitle}>
                    {seasonalTemplate?.seasonal_card_icon || "🌙"}{" "}
                    {isRTL
                      ? seasonalTemplate.name_ar
                      : seasonalTemplate.name_en}
                  </Text>
                  <View
                    style={[
                      styles.wirdCountBadge,
                      {
                        backgroundColor: `${seasonalTemplate?.seasonal_card_accent || "#C47CFF"}33`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.wirdCountText,
                        {
                          color:
                            seasonalTemplate?.seasonal_card_accent || "#C47CFF",
                        },
                      ]}
                    >
                      {seasonalDoneCount}/{seasonalItems.length}
                    </Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.wirdProgressBg}>
                  <View
                    style={[
                      styles.wirdProgressFill,
                      {
                        width: `${
                          seasonalItems.length > 0
                            ? (seasonalDoneCount / seasonalItems.length) * 100
                            : 0
                        }%` as any,
                        backgroundColor:
                          seasonalTemplate?.seasonal_card_accent || "#C47CFF",
                      },
                    ]}
                  />
                </View>

                {seasonalItems.map((item: any, i: number) => {
                  const done = item.is_completed;
                  return (
                    <Animated.View
                      key={item.id || i}
                      style={{
                        transform: [{ scale: getWirdScale(`s_${item.id}`) }],
                      }}
                    >
                      <Pressable
                        onPress={() => handleSeasonalWirdToggle(item)}
                        style={[styles.wirdItem, done && styles.wirdItemDone]}
                      >
                        <View
                          style={[
                            styles.wirdCheckbox,
                            done && {
                              ...styles.wirdCheckboxDone,
                              backgroundColor:
                                seasonalTemplate?.seasonal_card_accent ||
                                "#7C3AED",
                            },
                          ]}
                        >
                          {done && <Text style={styles.wirdCheckmark}>✓</Text>}
                        </View>
                        <Text
                          style={[
                            styles.wirdItemLabel,
                            done && styles.wirdItemLabelDone,
                          ]}
                        >
                          {isRTL
                            ? item.text_ar
                            : item.meaning_en || item.text_en || item.text_ar}
                        </Text>
                        {done && <Text style={{ fontSize: 14 }}>⭐</Text>}
                      </Pressable>
                    </Animated.View>
                  );
                })}

                {seasonalComplete ? (
                  <View style={styles.wirdCompleteRow}>
                    <Text
                      style={[
                        styles.wirdCompleteText,
                        {
                          color:
                            seasonalTemplate?.seasonal_card_accent || "#C47CFF",
                        },
                      ]}
                    >
                      {t.seasonalWirdComplete}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.wirdRewardHint}>
                    {isRTL
                      ? `أكمل وردك الموسمي للحصول على ${seasonalTemplate?.reward_stars || 50} ⭐`
                      : `Complete all to earn ${seasonalTemplate?.reward_stars || 50} ⭐`}
                  </Text>
                )}
              </LinearGradient>
            </>
          )}

        {/* ══════════════════════════════════════════
            DAILY GOAL
        ══════════════════════════════════════════ */}
        {goal && (
          <>
            <Text style={[styles.sectionTitle]}>🎯 {t.todayProg}</Text>
            <LinearGradient
              colors={["#1C1000", "#2E1A00"]}
              style={styles.goalCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.goalWatermark}>🎯</Text>
              <View style={styles.goalHeader}>
                <Text style={styles.goalLabel}>
                  📖 {isRTL ? "الهدف اليومي" : "Daily Quest"}
                </Text>
                <Text style={styles.goalCount}>
                  {goalProgress}
                  <Text style={styles.goalCountSub}>/{goalTarget}</Text>
                </Text>
              </View>

              {/* Star dots */}
              <View style={styles.goalDotsRow}>
                {Array.from({ length: goalTarget }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.goalDot,
                      i < goalProgress
                        ? styles.goalDotEarned
                        : styles.goalDotEmpty,
                    ]}
                  >
                    {i < goalProgress && (
                      <Text style={{ fontSize: 9 }}>⭐</Text>
                    )}
                  </View>
                ))}
              </View>

              <View style={styles.goalBarBg}>
                <LinearGradient
                  colors={goalDone ? [C.mint, "#00A36C"] : [C.gold, "#FF9100"]}
                  style={[styles.goalBarFill, { width: `${goalPct}%` as any }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>

              <Text style={styles.goalHint}>
                {goalDone
                  ? isRTL
                    ? "🎉 أحسنت! أكملت هدفك"
                    : "🎉 Quest complete!"
                  : isRTL
                    ? `باقي ${goalTarget - goalProgress} أذكار`
                    : `${goalTarget - goalProgress} more dhikr to go!`}
              </Text>
            </LinearGradient>
          </>
        )}

        {/* ══════════════════════════════════════════
            COMMUNITY CHALLENGES
        ══════════════════════════════════════════ */}
        {flags.challenges && (
          <>
            {activeCommunity.length > 0 && (
              <Text style={[styles.sectionTitle]}>{t.weekChall}</Text>
            )}
            {activeCommunity.map((ch: any) => {
              const hasJoined = ch.challenge_participants?.some(
                (p: any) => p.kid_id === kidId,
              );
              const daysLeft = Math.max(
                0,
                Math.ceil(
                  (new Date(ch.end_date).getTime() - Date.now()) / 86400000,
                ),
              );
              const challPct = Math.min(
                ((ch.progress || 0) / (ch.goal || 1)) * 100,
                100,
              );
              return (
                <Pressable
                  key={ch.id}
                  onPress={
                    hasJoined
                      ? () => {
                          router.push(`/challenge/${ch.id}`);
                        }
                      : undefined
                  }
                >
                  <LinearGradient
                    colors={["#0D0033", "#1A0055"]}
                    style={styles.challCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.challWatermark}>🏆</Text>
                    <Text style={styles.challWeekLabel}>
                      🌍 {isRTL ? "هذا الأسبوع" : "This Week"}
                    </Text>
                    <Text style={styles.challTitle}>
                      {isRTL ? ch.name_ar : ch.name_en}
                    </Text>
                    {!!(isRTL ? ch.description_ar : ch.description_en) && (
                      <Text style={styles.challDesc}>
                        {isRTL ? ch.description_ar : ch.description_en}
                      </Text>
                    )}
                    <View style={styles.challBarBg}>
                      <LinearGradient
                        colors={[C.lavender, C.cyan]}
                        style={[
                          styles.challBarFill,
                          { width: `${challPct}%` as any },
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      />
                    </View>
                    <View style={styles.challFooter}>
                      <Text style={styles.challFooterText}>
                        {ch.progress || 0}/{ch.goal || 0} ⏰ {daysLeft} {t.days}
                      </Text>
                    </View>
                    <View style={styles.challRewardsRow}>
                      <View style={styles.challRewardBadge}>
                        <Text style={styles.challRewardText}>
                          🥇 {ch.reward_stars || 50} ⭐
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.challRewardBadge,
                          {
                            backgroundColor: C.lavDim,
                            borderColor: C.lavBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.challRewardText,
                            { color: C.lavender },
                          ]}
                        >
                          🥈{" "}
                          {ch.reward_stars_2nd ||
                            Math.round((ch.reward_stars || 50) * 0.7)}{" "}
                          ⭐
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.challRewardBadge,
                          {
                            backgroundColor: C.cyanDim,
                            borderColor: C.cyanBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.challRewardText, { color: C.cyan }]}
                        >
                          🥉{" "}
                          {ch.reward_stars_3rd ||
                            Math.round((ch.reward_stars || 50) * 0.5)}{" "}
                          ⭐
                        </Text>
                      </View>
                    </View>
                    {!hasJoined && (
                      <Pressable
                        style={styles.joinBtn}
                        onPress={async () => {
                          if (!kidId) return;
                          try {
                            await challengesService.joinChallenge(ch.id, kidId);
                            refreshChallenges();
                          } catch {}
                        }}
                      >
                        <LinearGradient
                          colors={[C.lavender, C.cyan]}
                          style={styles.joinBtnInner}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Text style={styles.joinBtnText}>
                            {isRTL ? "🚀 انضم للتحدي!" : "🚀 Join Challenge!"}
                          </Text>
                        </LinearGradient>
                      </Pressable>
                    )}
                  </LinearGradient>
                </Pressable>
              );
            })}

            {/* ══════════════════════════════════════════
            COMPLETED CHALLENGES
        ══════════════════════════════════════════ */}
            {recentlyCompletedCommunity.slice(0, 2).map((ch: any) => {
              const myPart = ch.challenge_participants?.find(
                (p: any) => p.kid_id === kidId,
              );
              if (!myPart) return null;
              const sorted = [...(ch.challenge_participants || [])].sort(
                (a: any, b: any) =>
                  (b.contribution || 0) - (a.contribution || 0),
              );
              const top3 = sorted.slice(0, 3);
              const myRank =
                sorted.findIndex((p: any) => p.kid_id === kidId) + 1;
              const totalP = ch.challenge_participants?.length || 0;
              return (
                <LinearGradient
                  key={ch.id}
                  colors={["#0A1A2E", "#0D2440"]}
                  style={styles.endedCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.endedHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.endedTitle}>
                        🏆 {isRTL ? ch.name_ar : ch.name_en}
                      </Text>
                      <Text style={styles.endedSub}>
                        {ch.progress || 0}/{ch.goal || 0} • 👥 {totalP}
                      </Text>
                    </View>
                    <View style={styles.endedBadge}>
                      <Text style={styles.endedBadgeText}>
                        {isRTL ? "انتهى" : "Ended"}
                      </Text>
                    </View>
                  </View>
                  {top3.length > 0 && (
                    <View style={styles.endedPodiumRow}>
                      {top3.map((p: any, i: number) => {
                        const isMe = p.kid_id === kidId;
                        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
                        return (
                          <View
                            key={p.kid_id}
                            style={[
                              styles.endedWinner,
                              isMe && styles.endedWinnerMe,
                            ]}
                          >
                            <Text style={{ fontSize: 16 }}>{medal}</Text>
                            <Text style={{ fontSize: 20 }}>
                              {p.kids?.avatar || "🌟"}
                            </Text>
                            <Text
                              style={[
                                styles.endedWinnerName,
                                isMe && { color: C.cyan },
                              ]}
                              numberOfLines={1}
                            >
                              {isMe
                                ? isRTL
                                  ? "أنت"
                                  : "You"
                                : p.kids?.name || "?"}
                            </Text>
                            <Text style={styles.endedWinnerScore}>
                              {p.contribution || 0}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                  <View style={styles.endedMyRow}>
                    <Text style={styles.endedMyText}>
                      {myRank === 1
                        ? "🥇"
                        : myRank === 2
                          ? "🥈"
                          : myRank === 3
                            ? "🥉"
                            : "🏅"}{" "}
                      {isRTL ? `مركزك #${myRank}` : `Rank #${myRank}`} •{" "}
                      {myPart.contribution || 0} 📿 • +{ch.reward_stars || 50}{" "}
                      ⭐
                    </Text>
                  </View>
                </LinearGradient>
              );
            })}
          </>
        )}

        {/* ══════════════════════════════════════════
            FRIENDS LEADERBOARD
        ══════════════════════════════════════════ */}
        {flags.friends && flags.leaderboard && (
          <View style={styles.friendsCard}>
            <View style={styles.friendsHeader}>
              <Text style={styles.friendsTitle}>
                🏆 {isRTL ? "المتصدرون" : "Leaderboard"}
              </Text>
              <Pressable
                style={styles.seeAllChip}
                onPress={() => router.push("/(tabs)/challenges")}
              >
                <Text style={styles.seeAllText}>
                  {isRTL ? "الكل ←" : "See All →"}
                </Text>
              </Pressable>
            </View>

            {friends.length === 0 ? (
              <Pressable
                style={styles.friendsEmpty}
                onPress={() => router.push("/(tabs)/challenges")}
              >
                <Text style={{ fontSize: 36 }}>👥</Text>
                <Text style={styles.friendsEmptyText}>
                  {isRTL
                    ? "ادعُ أصدقاءك! اضغط هنا"
                    : "Invite your friends! Tap here"}
                </Text>
              </Pressable>
            ) : (
              <View style={{ gap: 2 }}>
                {friends.slice(0, 5).map((friend: any, i: number) => {
                  const rankEmoji =
                    i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🏅";
                  const fLevel = getLevelFromStars(friend?.stars ?? 0);
                  return (
                    <View
                      key={friend?.id}
                      style={[
                        styles.friendRow,
                        i === friends.slice(0, 5).length - 1 && {
                          borderBottomWidth: 0,
                        },
                      ]}
                    >
                      <Text style={styles.friendRankEmoji}>{rankEmoji}</Text>
                      <View>
                        <LinearGradient
                          colors={["#0D1A3A", "#1A2A5A"]}
                          style={styles.friendAvatar}
                        >
                          <Text style={{ fontSize: 20 }}>
                            {friend?.avatar || "🌟"}
                          </Text>
                        </LinearGradient>
                        <LinearGradient
                          colors={fLevel.gradient}
                          style={styles.friendLvlBadge}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Text style={styles.friendLvlText}>
                            {fLevel.emoji}
                            {fLevel.level}
                          </Text>
                        </LinearGradient>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.friendName}>
                          {friend?.name || ""}
                        </Text>
                      </View>
                      <View style={styles.friendStatsRow}>
                        <View style={styles.friendGoldPill}>
                          <Text style={styles.friendGoldText}>
                            ⭐ {friend?.stars ?? 0}
                          </Text>
                        </View>
                        <View style={styles.friendCoralPill}>
                          <Text style={styles.friendCoralText}>
                            🔥 {friend?.streak ?? 0}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ══════════════════════════════════════════
            CATEGORY GRID
        ══════════════════════════════════════════ */}
        <Text style={[styles.sectionTitle, isRTL && styles.rtlLeft]}>
          {t.pickDhikr}
        </Text>
        <View style={styles.catGrid}>
          {categories.map((cat, index) => {
            const gradient = resolveGradient(cat.gradient);
            return (
              <Pressable
                key={cat.id}
                onPress={() => router.push(`/dhikr/${cat.id}`)}
                style={({ pressed }) => [
                  { transform: [{ scale: pressed ? 0.92 : 1 }] },
                ]}
              >
                <LinearGradient
                  colors={gradient as [string, string, ...string[]]}
                  style={styles.catCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {/* Subtle shine corner */}
                  <View style={styles.catCardShine} />
                  <Text style={styles.catIcon}>{cat.icon}</Text>
                  <Text style={styles.catTitle}>
                    {isRTL ? cat.title_ar : cat.title_en}
                  </Text>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>

        {/* ══════════════════════════════════════════
            CHALLENGE DETAIL OVERLAY
        ══════════════════════════════════════════ */}
        <Modal
          visible={showChallOverlay}
          transparent
          animationType="slide"
          onRequestClose={() => setShowChallOverlay(false)}
        >
          <Pressable
            style={styles.overlayBackdrop}
            onPress={() => setShowChallOverlay(false)}
          >
            <View style={styles.overlaySheet}>
              <View style={styles.overlayHandle} />
              <Text style={styles.overlayEmojiLarge}>🎯</Text>
              <Text style={styles.overlaySheetTitle}>
                {isRTL ? "تفاصيل التحدي" : "Challenge Details"}
              </Text>
              {selectedChallenge && (
                <>
                  <Text style={styles.overlayChallName}>
                    {isRTL
                      ? selectedChallenge.name_ar
                      : selectedChallenge.name_en}
                  </Text>
                  <View style={styles.overlayProgressWrap}>
                    <View style={styles.overlayProgressRow}>
                      <Text style={styles.overlayProgressLabel}>
                        {isRTL ? "التقدم" : "Progress"}
                      </Text>
                      <Text style={styles.overlayProgressNum}>
                        {selectedChallenge.progress || 0}/
                        {selectedChallenge.goal || 0}
                      </Text>
                    </View>
                    <View style={styles.overlayBarBg}>
                      <LinearGradient
                        colors={[C.lavender, C.cyan]}
                        style={[
                          styles.overlayBarFill,
                          {
                            width: `${Math.min(
                              ((selectedChallenge.progress || 0) /
                                (selectedChallenge.goal || 1)) *
                                100,
                              100,
                            )}%` as any,
                          },
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      />
                    </View>
                  </View>
                  <View style={styles.overlayStatsRow}>
                    <View style={styles.overlayStat}>
                      <Text style={styles.overlayStatNum}>
                        +{selectedChallenge.reward_stars || 50} ⭐
                      </Text>
                      <Text style={styles.overlayStatLabel}>
                        {isRTL ? "المكافأة" : "Reward"}
                      </Text>
                    </View>
                    <View style={styles.overlayStat}>
                      <Text style={[styles.overlayStatNum, { color: C.coral }]}>
                        {Math.max(
                          0,
                          Math.ceil(
                            (new Date(selectedChallenge.end_date).getTime() -
                              Date.now()) /
                              86400000,
                          ),
                        )}{" "}
                        {t.days}
                      </Text>
                      <Text style={styles.overlayStatLabel}>
                        {isRTL ? "المتبقي" : "Remaining"}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </Pressable>
        </Modal>

        {/* ══════════════════════════════════════════
            STREAK MILESTONE MODAL
        ══════════════════════════════════════════ */}
        <Modal
          visible={isNewMilestone}
          transparent
          animationType="fade"
          onRequestClose={dismissMilestone}
        >
          <View style={styles.milestoneOverlay}>
            <LinearGradient
              colors={["#1A0A3A", "#0D0033"]}
              style={styles.milestoneModal}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.milestoneEmoji}>
                {getStreakMessage(milestoneType, isRTL).emoji}
              </Text>
              <Text style={styles.milestoneTitle}>
                {getStreakMessage(milestoneType, isRTL).title}
              </Text>
              <Text style={styles.milestoneSub}>
                {getStreakMessage(milestoneType, isRTL).subtitle}
              </Text>
              <Text style={styles.milestoneCount}>
                {streak} {isRTL ? "يوم متواصل!" : "day streak!"}
              </Text>
              <Pressable
                style={styles.milestoneDismissBtn}
                onPress={dismissMilestone}
              >
                <LinearGradient
                  colors={[C.coral, "#FF4081"]}
                  style={styles.milestoneDismissInner}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.milestoneDismissText}>
                    {isRTL ? "يلا نكمل! 💪" : "Let's keep going! 💪"}
                  </Text>
                </LinearGradient>
              </Pressable>
            </LinearGradient>
          </View>
        </Modal>

        <View style={{ height: 100 }} />
      </ScrollView>

      <LevelRoad
        visible={showLevelRoad}
        onClose={() => setShowLevelRoad(false)}
        currentLevel={currentLevel.level}
        stars={totalStars}
        progress={levelProg}
        isRTL={isRTL}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // ── Header ──
  header: {
    flexDirection: "column",
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 16,
    position: "relative",
    overflow: "hidden",
    gap: 12,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  blobCyan: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(0,229,255,0.07)",
    top: -60,
    right: -40,
  },
  blobCoral: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,107,157,0.06)",
    bottom: -40,
    left: 60,
  },
  starDot: {
    position: "absolute",
    borderRadius: 2,
    backgroundColor: "#fff",
    opacity: 0.5,
  },

  // Avatar
  avatarOuter: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarRing: {
    position: "absolute",
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: C.gold,
    borderStyle: "dashed",
    opacity: 0.7,
  },
  avatarInner: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#0D1A40",
    borderWidth: 2,
    borderColor: C.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  avatarEmoji: { fontSize: 28 },
  avatarImage: { width: 48, height: 48, borderRadius: 14 },
  lvlBadge: {
    position: "absolute",
    bottom: -7,
    right: -10,
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: C.bg,
  },
  lvlBadgeText: { fontSize: 9, fontWeight: "900", color: "#060B27" },
  avatarEditBadge: {
    position: "absolute",
    top: -5,
    left: -5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.cyan,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.bg,
    zIndex: 10,
  },
  avatarEditIcon: { fontSize: 10 },
  avatarModalSheetScroll: {
    backgroundColor: "#0F1E35",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  avatarModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },

  // replace old avatarModalSheet
  avatarModalSheet: {
    backgroundColor: "#0F1E35",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 44,
  },

  // new
  profileModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  profileCloseX: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileCloseXText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "800",
  },
  avatarModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 20,
  },
  avatarModalClose: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  avatarModalCloseText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: "700",
  },
  profileLabel: {
    alignSelf: "flex-start",
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  profileInput: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  profileBtnRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
    width: "100%",
    justifyContent: "center",
  },
  profileSaveBtn: {
    marginTop: 20,
    width: "100%",
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#00E5FF",
    alignItems: "center",
  },
  profileSaveBtnText: {
    color: "#060B27",
    fontSize: 16,
    fontWeight: "900",
  },

  appLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: C.cyan,
    letterSpacing: 1,
  },
  greetingText: { fontSize: 19, fontWeight: "900", color: C.white },
  headerPills: { flexDirection: "row", gap: 6, marginTop: 5 },
  goldPill: {
    backgroundColor: C.goldDim,
    borderRadius: 50,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  goldPillText: { fontSize: 12, fontWeight: "900", color: C.gold },
  cyanPill: {
    backgroundColor: C.cyanDim,
    borderRadius: 50,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: C.cyanBorder,
  },
  cyanPillText: { fontSize: 12, fontWeight: "900", color: C.cyan },

  langChip: {
    backgroundColor: C.cyanDim,
    borderWidth: 1,
    borderColor: C.cyanBorder,
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  langChipText: { fontSize: 11, fontWeight: "800", color: C.cyan },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutChip: {
    backgroundColor: "rgba(255,107,157,0.1)",
    borderColor: C.coralBorder,
  },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: C.coral,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: C.bg,
  },
  notifBadgeText: { fontSize: 9, fontWeight: "800", color: "#fff" },

  // ── Streak Card ──
  streakCard: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    borderRadius: 24,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1.5,
    borderColor: C.coralBorder,
    shadowColor: C.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    overflow: "hidden",
    position: "relative",
  },
  streakWatermark: {
    position: "absolute",
    fontSize: 110,
    opacity: 0.05,
    right: -10,
    top: -15,
  },
  streakLeft: { alignItems: "center" },
  streakFireEmoji: { fontSize: 36 },
  streakNum: {
    fontSize: 26,
    fontWeight: "900",
    color: C.coral,
    lineHeight: 30,
  },
  streakDaysWord: {
    fontSize: 9,
    fontWeight: "800",
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  streakDivider: {
    width: 1,
    height: 60,
    backgroundColor: "rgba(255,107,157,0.2)",
  },
  streakTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: C.white,
    marginBottom: 2,
  },
  streakSub: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textMuted,
    marginBottom: 10,
  },
  weekRow: { flexDirection: "row", gap: 4 },
  weekDot: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  weekDotDone: { backgroundColor: C.coral },
  weekDotMissed: { backgroundColor: "rgba(255,107,157,0.15)" },
  weekDotToday: { borderWidth: 1.5, borderColor: C.coral },
  weekDotText: { fontSize: 9, fontWeight: "800", color: C.textMuted },
  weekDotTextDone: { color: "#fff" },
  weekDotTextMissed: { color: "rgba(255,107,157,0.6)" },

  // ── Section Title ──
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: C.white,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  rtlText: { textAlign: "right" },
  rtlLeft: { textAlign: "left" },

  // ── Wird ──
  wirdCard: {
    marginHorizontal: 16,
    borderRadius: 26,
    padding: 18,
    borderWidth: 1.5,
    borderColor: C.mintBorder,
    shadowColor: C.mint,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 10,
    overflow: "hidden",
    position: "relative",
  },
  wirdWatermark: {
    position: "absolute",
    fontSize: 110,
    opacity: 0.05,
    right: -10,
    top: -10,
  },
  wirdHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  wirdTitle: { fontSize: 15, fontWeight: "900", color: C.white },
  wirdCountBadge: {
    backgroundColor: "rgba(0,245,160,0.2)",
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.mintBorder,
  },
  wirdCountText: { fontSize: 12, color: C.mint, fontWeight: "900" },
  wirdProgressBg: {
    height: 7,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 50,
    overflow: "hidden",
    marginBottom: 14,
  },
  wirdProgressFill: {
    height: "100%",
    backgroundColor: C.mint,
    borderRadius: 50,
    shadowColor: C.mint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  wirdItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  wirdItemDone: {
    backgroundColor: "rgba(0,245,160,0.1)",
    borderColor: "rgba(0,245,160,0.25)",
  },
  wirdCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  wirdCheckboxDone: {
    backgroundColor: C.mint,
    borderColor: C.mint,
    shadowColor: C.mint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 3,
  },
  wirdCheckmark: { color: "#003D28", fontSize: 14, fontWeight: "900" },
  wirdItemLabel: { flex: 1, fontSize: 14, fontWeight: "700", color: C.white },
  wirdItemLabelDone: { textDecorationLine: "line-through", opacity: 0.5 },
  wirdCompleteRow: {
    alignItems: "center",
    backgroundColor: "rgba(0,245,160,0.15)",
    borderRadius: 14,
    paddingVertical: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: C.mintBorder,
  },
  wirdCompleteText: { fontSize: 15, fontWeight: "900", color: C.mint },
  wirdRewardHint: {
    fontSize: 11,
    color: C.textMuted,
    textAlign: "center",
    marginTop: 8,
    fontWeight: "700",
  },

  // ── Goal Card ──
  goalCard: {
    borderRadius: 24,
    padding: 18,
    marginHorizontal: 16,
    borderWidth: 1.5,
    borderColor: C.goldBorder,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 6,
    position: "relative",
    overflow: "hidden",
  },
  goalWatermark: {
    position: "absolute",
    fontSize: 90,
    opacity: 0.05,
    right: 10,
    top: "50%",
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  goalLabel: { fontSize: 14, fontWeight: "800", color: C.white },
  goalCount: { fontSize: 26, fontWeight: "900", color: C.gold },
  goalCountSub: { fontSize: 14, color: C.textMuted },
  goalDotsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 5,
    marginBottom: 14,
  },
  goalDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  goalDotEarned: {
    backgroundColor: C.goldDim,
    borderWidth: 1.5,
    borderColor: C.goldBorder,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 3,
  },
  goalDotEmpty: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  goalBarBg: {
    height: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 50,
    overflow: "hidden",
  },
  goalBarFill: { height: "100%", borderRadius: 50 },
  goalHint: {
    fontSize: 11,
    color: C.textSub,
    marginTop: 10,
    textAlign: "center",
    fontWeight: "700",
  },

  // ── Challenge Card ──
  challCard: {
    marginHorizontal: 16,
    borderRadius: 26,
    padding: 18,
    borderWidth: 1.5,
    borderColor: C.lavBorder,
    shadowColor: C.lavender,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
    overflow: "hidden",
    position: "relative",
    marginBottom: 12,
  },
  challWatermark: {
    position: "absolute",
    fontSize: 110,
    opacity: 0.05,
    right: -10,
    top: -10,
  },
  challWeekLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: C.lavender,
    marginBottom: 4,
  },
  challTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: C.white,
    marginBottom: 6,
    maxWidth: "75%",
  },
  challDesc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 10,
    lineHeight: 19,
  },
  challBarBg: {
    height: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 50,
    overflow: "hidden",
    marginBottom: 10,
  },
  challBarFill: { height: "100%", borderRadius: 50 },
  challFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  challFooterText: { fontSize: 12, color: C.textSub, fontWeight: "700" },
  challRewardsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  challRewardBadge: {
    backgroundColor: C.goldDim,
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  challRewardText: { fontSize: 11, fontWeight: "900", color: C.gold },
  joinBtn: {
    marginTop: 12,
    borderRadius: 16,
    overflow: "hidden",
  },
  joinBtnInner: {
    paddingVertical: 13,
    alignItems: "center",
    borderRadius: 16,
  },
  joinBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },

  // ── Ended Challenge (rich results) ──
  endedCard: {
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: "rgba(0,229,255,0.15)",
    overflow: "hidden",
  },
  endedHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  endedTitle: { fontSize: 14, fontWeight: "900", color: C.white },
  endedSub: { fontSize: 11, color: C.textSub, fontWeight: "700", marginTop: 2 },
  endedBadge: {
    backgroundColor: "rgba(0,245,160,0.12)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.mintBorder,
  },
  endedBadgeText: { fontSize: 10, fontWeight: "800", color: C.mint },
  endedPodiumRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10,
  },
  endedWinner: {
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 72,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  endedWinnerMe: {
    backgroundColor: "rgba(0,229,255,0.1)",
    borderColor: "rgba(0,229,255,0.25)",
  },
  endedWinnerName: {
    fontSize: 10,
    fontWeight: "800",
    color: C.textSub,
    maxWidth: 60,
    textAlign: "center",
  },
  endedWinnerScore: { fontSize: 13, fontWeight: "900", color: C.gold },
  endedMyRow: {
    backgroundColor: "rgba(0,229,255,0.06)",
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.2)",
  },
  endedMyText: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(0,229,255,0.9)",
  },

  // ── Completed Challenge (legacy) ──
  completedCard: {
    backgroundColor: "rgba(0,245,160,0.06)",
    borderRadius: 20,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: "rgba(0,245,160,0.18)",
  },
  completedCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  completedCardName: { fontSize: 14, fontWeight: "900", color: C.mint },
  finishedBadge: {
    backgroundColor: "rgba(0,245,160,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: C.mintBorder,
  },
  finishedBadgeText: { fontSize: 11, fontWeight: "800", color: C.mint },
  completedCardStats: { fontSize: 13, color: C.textSub, fontWeight: "700" },

  // ── Friends ──
  friendsCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 24,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  friendsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  friendsTitle: { fontSize: 16, fontWeight: "900", color: C.white },
  seeAllChip: {
    backgroundColor: C.cyanDim,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: C.cyanBorder,
  },
  seeAllText: { fontSize: 12, fontWeight: "900", color: C.cyan },
  friendsEmpty: { alignItems: "center", paddingVertical: 18, gap: 8 },
  friendsEmptyText: { fontSize: 13, fontWeight: "700", color: C.textMuted },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  friendRankEmoji: { fontSize: 16, width: 22, textAlign: "center" },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  friendLvlBadge: {
    position: "absolute",
    bottom: -4,
    alignSelf: "center",
    borderRadius: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: C.bg,
  },
  friendLvlText: { fontSize: 8, fontWeight: "900", color: "#fff" },
  friendName: { fontSize: 14, fontWeight: "800", color: C.white },
  friendStatsRow: { flexDirection: "row", gap: 6 },
  friendGoldPill: {
    backgroundColor: C.goldDim,
    borderRadius: 50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  friendGoldText: { fontSize: 11, fontWeight: "800", color: C.gold },
  friendCoralPill: {
    backgroundColor: C.coralDim,
    borderRadius: 50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.coralBorder,
  },
  friendCoralText: { fontSize: 11, fontWeight: "800", color: C.coral },

  // ── Category Grid ──
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  catCard: {
    width: CAT_CARD_SIZE,
    minHeight: 100,
    borderRadius: 22,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
    position: "relative",
    overflow: "hidden",
  },
  catCardShine: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.12)",
    transform: [{ translateX: -15 }, { translateY: -15 }],
  },
  catIcon: { fontSize: 30 },
  catTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    lineHeight: 16,
  },

  // ── Overlays & Modals ──
  overlayBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  overlaySheet: {
    backgroundColor: "#0D1040",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 28,
    paddingBottom: 44,
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  overlayHandle: {
    width: 44,
    height: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 50,
    marginBottom: 20,
  },
  overlayEmojiLarge: { fontSize: 50 },
  overlaySheetTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: C.white,
    marginTop: 10,
  },
  overlayChallName: {
    fontSize: 15,
    fontWeight: "700",
    color: C.lavender,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 24,
  },
  overlayProgressWrap: { width: "100%", marginTop: 18 },
  overlayProgressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  overlayProgressLabel: { fontSize: 13, fontWeight: "700", color: C.white },
  overlayProgressNum: { fontSize: 13, fontWeight: "900", color: C.lavender },
  overlayBarBg: {
    height: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 50,
    overflow: "hidden",
  },
  overlayBarFill: { height: "100%", borderRadius: 50 },
  overlayStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
    width: "100%",
  },
  overlayStat: { alignItems: "center", gap: 4 },
  overlayStatNum: { fontSize: 20, fontWeight: "900", color: C.gold },
  overlayStatLabel: { fontSize: 11, fontWeight: "700", color: C.textMuted },

  // ── Streak Milestone Modal ──
  milestoneOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  milestoneModal: {
    borderRadius: 30,
    padding: 34,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: C.coralBorder,
    width: "100%",
    maxWidth: 340,
    shadowColor: C.coral,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 20,
  },
  milestoneEmoji: { fontSize: 68, marginBottom: 14 },
  milestoneTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: C.coral,
    textAlign: "center",
    marginBottom: 8,
  },
  milestoneSub: {
    fontSize: 15,
    color: C.textSub,
    textAlign: "center",
    marginBottom: 8,
    fontWeight: "700",
  },
  milestoneCount: {
    color: C.textMuted,
    fontSize: 13,
    marginBottom: 28,
    textAlign: "center",
    fontWeight: "700",
  },
  milestoneDismissBtn: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: C.coral,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  milestoneDismissInner: {
    paddingHorizontal: 36,
    paddingVertical: 15,
    borderRadius: 20,
  },
  milestoneDismissText: { color: "#fff", fontSize: 16, fontWeight: "900" },
});
