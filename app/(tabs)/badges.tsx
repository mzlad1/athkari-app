import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
  Animated,
} from "react-native";
import { COLORS, GRADIENTS, resolveGradient } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { useBadges } from "@/hooks/useBadges";
import { useKidStats } from "@/hooks/useKidStats";
import { useCategories } from "@/hooks/useCategories";
import { completedCategoriesService } from "@/services/completed-categories";
import { badgeService } from "@/services/badges";
import { supabase } from "@/services/supabase";
import { useState, useCallback, useRef, useEffect } from "react";
import { useFocusEffect } from "expo-router";
import { T } from "@/constants/translations";
import { LinearGradient } from "expo-linear-gradient";
import { BadgesSkeleton } from "@/components/ui/Skeleton";

const { width } = Dimensions.get("window");

// ─── Design Tokens (matches home screen) ─────────────────────────────────────
const C = {
  bg: "#06091E",
  bgCard: "rgba(255,255,255,0.05)",
  bgCardBorder: "rgba(255,255,255,0.09)",
  cyan: "#00E5FF",
  cyanDim: "rgba(0,229,255,0.12)",
  cyanBorder: "rgba(0,229,255,0.28)",
  gold: "#FFD60A",
  goldDim: "rgba(255,214,10,0.13)",
  goldBorder: "rgba(255,214,10,0.3)",
  coral: "#FF6B9D",
  coralDim: "rgba(255,107,157,0.13)",
  coralBorder: "rgba(255,107,157,0.3)",
  mint: "#00F5A0",
  mintDim: "rgba(0,245,160,0.12)",
  mintBorder: "rgba(0,245,160,0.25)",
  lavender: "#B388FF",
  lavDim: "rgba(179,136,255,0.12)",
  lavBorder: "rgba(179,136,255,0.28)",
  sky: "#40C4FF",
  white: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.4)",
  textSub: "rgba(255,255,255,0.6)",
};

export default function BadgesScreen() {
  const { activeKid } = useAuth();
  const { lang } = useLang();
  const isRTL = lang === "ar";
  const t = T[lang];
  const kidId = activeKid?.id ?? undefined;

  const {
    badges,
    loading: badgesLoading,
    refresh: refreshBadges,
  } = useBadges(kidId);
  const { stats, loading: statsLoading } = useKidStats(kidId);
  const { categories } = useCategories();
  const [wirdComplete, setWirdComplete] = useState(false);
  const [wirdDoneCount, setWirdDoneCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [completedCatIds, setCompletedCatIds] = useState<Set<number>>(
    new Set(),
  );

  // Spinning ring for header medal
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 14000,
        useNativeDriver: true,
      }),
    ).start();
  }, []);
  const spinDeg = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const loadCompletedCats = useCallback(async () => {
    if (!kidId) return;
    const today = new Date().toISOString().split("T")[0];
    const [ids, { data: log }] = await Promise.all([
      completedCategoriesService.getCompleted(kidId),
      supabase
        .from("wird_logs")
        .select("is_complete, completed_items")
        .eq("kid_id", kidId)
        .eq("log_date", today)
        .maybeSingle(),
    ]);
    setCompletedCatIds(ids);
    setWirdComplete(log?.is_complete || false);
    setWirdDoneCount(log?.completed_items?.length || 0);
  }, [kidId]);

  useFocusEffect(
    useCallback(() => {
      loadCompletedCats();
      if (kidId) {
        badgeService
          .evaluateBadges(kidId)
          .catch(() => {})
          .finally(() => refreshBadges());
      }
    }, [loadCompletedCats, kidId]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (kidId) await badgeService.evaluateBadges(kidId).catch(() => {});
    await Promise.all([refreshBadges(), loadCompletedCats()]);
    setRefreshing(false);
  }, [refreshBadges, loadCompletedCats, kidId]);

  const totalDhikr = stats?.total_adhkar || 0;
  const streak = stats?.streak || 0;
  const stars = stats?.stars || 0;

  const earnedBadges = badges?.filter((b: any) => b.is_earned) || [];
  const lockedBadges = badges?.filter((b: any) => !b.is_earned) || [];
  const completedCatCount = completedCatIds.size;
  const totalCatCount = categories.length;

  if (badgesLoading && statsLoading) {
    return (
      <ScrollView style={styles.container}>
        <BadgesSkeleton />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={C.gold}
        />
      }
    >
      {/* ══════════════════════════════════════════
          HERO HEADER
      ══════════════════════════════════════════ */}
      <LinearGradient
        colors={["#0D1040", "#060918"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Ambient glow blobs */}
        <View style={styles.blobGold} />
        <View style={styles.blobLav} />

        {/* Decorative micro stars */}
        {[
          { top: 22, left: 40, s: 3 },
          { top: 50, left: 160, s: 2 },
          { top: 18, right: 70, s: 2.5 },
          { top: 68, right: 130, s: 2 },
          { top: 38, left: 230, s: 2 },
          { top: 80, left: 80, s: 1.5 },
        ].map((st, i) => (
          <View
            key={i}
            style={[
              styles.microStar,
              {
                top: st.top,
                left: (st as any).left,
                right: (st as any).right,
                width: st.s,
                height: st.s,
              },
            ]}
          />
        ))}

        {/* Big spinning medal */}
        <View style={styles.headerMedalWrap}>
          <Animated.View
            style={[styles.medalRing, { transform: [{ rotate: spinDeg }] }]}
          />
          <LinearGradient
            colors={["#1C1400", "#2E2000"]}
            style={styles.medalCircle}
          >
            <Text style={styles.medalEmoji}>🏅</Text>
          </LinearGradient>
          <LinearGradient
            colors={[C.gold, "#FF9100"]}
            style={styles.medalLvlBadge}
          >
            <Text style={styles.medalLvlText}>{earnedBadges.length} ✓</Text>
          </LinearGradient>
        </View>

        <View style={styles.headerText}>
          <Text style={styles.headerLabel}>✨ {t.achiev}</Text>
          <Text style={styles.headerTitle}>
            {isRTL ? "شاراتي 🏆" : "My Badges 🏆"}
          </Text>
          <Text style={styles.headerSub}>
            {isRTL
              ? "اجمع الشارات وافتخر بإنجازاتك!"
              : "Collect badges & show off your achievements!"}
          </Text>
        </View>
      </LinearGradient>

      {/* ══════════════════════════════════════════
          STATS ROW
      ══════════════════════════════════════════ */}
      <View style={styles.statsRow}>
        {[
          {
            colors: ["#1C0A00", "#2E1200"] as [string, string],
            border: C.coralBorder,
            glow: C.coral,
            num: totalDhikr,
            label: t.totalDhikr,
            emoji: "📿",
            numColor: C.coral,
          },
          {
            colors: ["#1A0A3A", "#2D1050"] as [string, string],
            border: C.lavBorder,
            glow: C.lavender,
            num: streak,
            label: t.streak,
            emoji: "🔥",
            numColor: C.lavender,
          },
          {
            colors: ["#1C1000", "#2E1A00"] as [string, string],
            border: C.goldBorder,
            glow: C.gold,
            num: stars,
            label: t.starsL,
            emoji: "⭐",
            numColor: C.gold,
          },
        ].map((s, i) => (
          <LinearGradient
            key={i}
            colors={s.colors}
            style={[
              styles.statCard,
              { borderColor: s.border, shadowColor: s.glow },
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.statEmoji}>{s.emoji}</Text>
            <Text style={[styles.statNum, { color: s.numColor }]}>{s.num}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </LinearGradient>
        ))}
      </View>

      {/* ══════════════════════════════════════════
          DAILY WIRD STATUS
      ══════════════════════════════════════════ */}
      {wirdComplete ? (
        <LinearGradient
          colors={["#003D28", "#005A3C"]}
          style={styles.wirdDoneCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.wirdCardWatermark}>✅</Text>
          <Text style={styles.wirdCardEmoji}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.wirdCardTitle}>
              {isRTL ? "الوِرد اليومي" : "Daily Wird"}
            </Text>
            <Text style={styles.wirdCardSubDone}>
              {isRTL ? "مكتمل — أحسنت! 🎉" : "Complete — Well done! 🎉"}
            </Text>
          </View>
          <View style={styles.wirdRewardBadge}>
            <Text style={styles.wirdRewardText}>+50 ⭐</Text>
          </View>
        </LinearGradient>
      ) : (
        <View style={styles.wirdPendingCard}>
          <Text style={styles.wirdCardWatermark}>📋</Text>
          <Text style={styles.wirdCardEmoji}>📋</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.wirdCardTitle, { color: C.white }]}>
              {isRTL ? "الوِرد اليومي" : "Daily Wird"}
            </Text>
            <Text style={styles.wirdCardSubPending}>
              {isRTL ? `${wirdDoneCount} مكتمل` : `${wirdDoneCount} completed`}
            </Text>
          </View>
          <View style={styles.wirdInProgressBadge}>
            <Text style={styles.wirdInProgressText}>
              {isRTL ? "جارٍ..." : "In progress"}
            </Text>
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════
          EARNED BADGES
      ══════════════════════════════════════════ */}
      {earnedBadges.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <View style={styles.sectionTitleWrap}>
              <LinearGradient
                colors={[C.gold, "#FF9100"]}
                style={styles.sectionIcon}
              >
                <Text style={{ fontSize: 14 }}>🏆</Text>
              </LinearGradient>
              <Text style={styles.sectionTitle}>{t.badgesL}</Text>
            </View>
            <View style={styles.sectionCountBadge}>
              <Text style={styles.sectionCountText}>{earnedBadges.length}</Text>
            </View>
          </View>

          <View style={styles.badgesGrid}>
            {earnedBadges.map((badge: any) => (
              <LinearGradient
                key={badge.id}
                colors={["#1C1000", "#2E1A00"]}
                style={styles.earnedBadgeCard}
              >
                {/* Glow ring */}
                <View style={styles.earnedBadgeRing}>
                  <LinearGradient
                    colors={[C.gold, "#FF9100"]}
                    style={styles.earnedBadgeCircle}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.earnedBadgeIcon}>{badge.icon}</Text>
                  </LinearGradient>
                </View>
                <Text style={styles.earnedBadgeName} numberOfLines={2}>
                  {isRTL ? badge.name_ar : badge.name_en}
                </Text>
                <View style={styles.earnedPill}>
                  <Text style={styles.earnedPillText}>
                    {isRTL ? "✅ مكتسب" : "✅ Earned"}
                  </Text>
                </View>
              </LinearGradient>
            ))}
          </View>
        </>
      )}

      {/* ══════════════════════════════════════════
          LOCKED BADGES
      ══════════════════════════════════════════ */}
      {lockedBadges.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <View style={styles.sectionTitleWrap}>
              <LinearGradient
                colors={["#1A1A3A", "#2A2A5A"]}
                style={[styles.sectionIcon, { borderColor: C.lavBorder }]}
              >
                <Text style={{ fontSize: 14 }}>🔒</Text>
              </LinearGradient>
              <Text style={styles.sectionTitle}>
                {isRTL ? "الشارات القادمة" : "Coming Up"}
              </Text>
            </View>
            <View
              style={[
                styles.sectionCountBadge,
                { backgroundColor: C.lavDim, borderColor: C.lavBorder },
              ]}
            >
              <Text style={[styles.sectionCountText, { color: C.lavender }]}>
                {lockedBadges.length}
              </Text>
            </View>
          </View>

          <View style={styles.lockedList}>
            {lockedBadges.map((badge: any) => {
              const progress = badge.progress || 0;
              return (
                <View key={badge.id} style={styles.lockedCard}>
                  {/* Icon */}
                  <View style={styles.lockedIconWrap}>
                    <Text style={styles.lockedIconEmoji}>{badge.icon}</Text>
                    <View style={styles.lockBadge}>
                      <Text style={{ fontSize: 9 }}>🔒</Text>
                    </View>
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lockedName}>
                      {isRTL ? badge.name_ar : badge.name_en}
                    </Text>
                    <View style={styles.lockedBarBg}>
                      <LinearGradient
                        colors={[C.lavender, C.cyan]}
                        style={[
                          styles.lockedBarFill,
                          { width: `${Math.min(progress, 100)}%` as any },
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      />
                    </View>
                    <Text style={styles.lockedProgressPct}>{progress}%</Text>
                  </View>

                  {/* Progress pill */}
                  <View style={styles.lockedPctPill}>
                    <Text style={styles.lockedPctText}>{progress}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* ══════════════════════════════════════════
          COMPLETED CATEGORIES
      ══════════════════════════════════════════ */}
      <View style={styles.sectionRow}>
        <View style={styles.sectionTitleWrap}>
          <LinearGradient
            colors={["#003D28", "#005A3C"]}
            style={[styles.sectionIcon, { borderColor: C.mintBorder }]}
          >
            <Text style={{ fontSize: 14 }}>🎮</Text>
          </LinearGradient>
          <Text style={styles.sectionTitle}>
            {isRTL ? "الأقسام المكتملة" : "Categories"}
          </Text>
        </View>
      </View>

      {/* Summary progress card */}
      <LinearGradient
        colors={["#003D28", "#004830"]}
        style={styles.catSummaryCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.catSummaryTop}>
          <Text style={styles.catSummaryLabel}>
            {isRTL ? "تقدمك اليوم" : "Today's Progress"}
          </Text>
          <Text style={styles.catSummaryCount}>
            {completedCatCount}
            <Text style={{ color: C.textMuted, fontSize: 13 }}>
              /{totalCatCount}
            </Text>
          </Text>
        </View>
        <View style={styles.catSummaryBarBg}>
          <View
            style={[
              styles.catSummaryBarFill,
              {
                width:
                  totalCatCount > 0
                    ? (`${Math.min((completedCatCount / totalCatCount) * 100, 100)}%` as any)
                    : "0%",
              },
            ]}
          />
        </View>
      </LinearGradient>

      <View style={styles.catGrid}>
        {categories.map((cat) => {
          const isDone = completedCatIds.has(cat.id);
          const gradientKey = cat.gradient || "general";
          const gradient = resolveGradient(cat.gradient);
          return (
            <View
              key={cat.id}
              style={[styles.catCard, !isDone && styles.catCardDim]}
            >
              {isDone ? (
                <LinearGradient
                  colors={gradient as [string, string, ...string[]]}
                  style={styles.catCardInner}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.catShine} />
                  <Text style={styles.catIcon}>{cat.icon}</Text>
                  <Text style={styles.catName}>
                    {isRTL ? cat.title_ar : cat.title_en}
                  </Text>
                  <View style={styles.catDoneCheck}>
                    <Text style={{ fontSize: 9 }}>✅</Text>
                  </View>
                </LinearGradient>
              ) : (
                <View style={styles.catCardInnerLocked}>
                  <Text style={[styles.catIcon, { opacity: 0.3 }]}>
                    {cat.icon}
                  </Text>
                  <Text style={styles.catNameLocked}>
                    {isRTL ? cat.title_ar : cat.title_en}
                  </Text>
                  <View style={styles.catLockMark}>
                    <Text style={{ fontSize: 11 }}>🔒</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* ══════════════════════════════════════════
          EMPTY STATE
      ══════════════════════════════════════════ */}
      {!badgesLoading && badges?.length === 0 && (
        <View style={styles.emptyState}>
          <LinearGradient
            colors={["#1C1000", "#2E1A00"]}
            style={styles.emptyCircle}
          >
            <Text style={{ fontSize: 44 }}>🏅</Text>
          </LinearGradient>
          <Text style={styles.emptyTitle}>
            {isRTL ? "ابدأ رحلتك!" : "Start your journey!"}
          </Text>
          <Text style={styles.emptyText}>
            {isRTL
              ? "ابدأ بقراءة الأذكار لتكسب شارات!"
              : "Start reading adhkar to earn badges!"}
          </Text>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const BADGE_SIZE = (width - 32 - 20) / 3;
const CAT_SIZE = (width - 32 - 20) / 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // ── Header ──
  header: {
    paddingHorizontal: 20,
    paddingTop: 62,
    paddingBottom: 24,
    position: "relative",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  blobGold: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,214,10,0.07)",
    top: -70,
    right: -50,
  },
  blobLav: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(179,136,255,0.06)",
    bottom: -50,
    left: 50,
  },
  microStar: {
    position: "absolute",
    borderRadius: 2,
    backgroundColor: "#fff",
    opacity: 0.45,
  },

  // Medal
  headerMedalWrap: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  medalRing: {
    position: "absolute",
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 2,
    borderColor: C.gold,
    borderStyle: "dashed",
    opacity: 0.65,
  },
  medalCircle: {
    width: 62,
    height: 62,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.goldBorder,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  medalEmoji: { fontSize: 30 },
  medalLvlBadge: {
    position: "absolute",
    bottom: -7,
    right: -10,
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: C.bg,
  },
  medalLvlText: { fontSize: 9, fontWeight: "900", color: "#060B27" },

  headerText: { flex: 1 },
  headerLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: C.gold,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerTitle: { fontSize: 22, fontWeight: "900", color: C.white },
  headerSub: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },

  // ── Stats Row ──
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 16,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: 22,
    padding: 14,
    alignItems: "center",
    gap: 4,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 7,
  },
  statEmoji: { fontSize: 22 },
  statNum: { fontSize: 20, fontWeight: "900" },
  statLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: C.textMuted,
    textAlign: "center",
  },

  // ── Wird Cards ──
  wirdDoneCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 16,
    gap: 12,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: C.mintBorder,
    shadowColor: C.mint,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
    overflow: "hidden",
    position: "relative",
  },
  wirdPendingCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 16,
    gap: 12,
    marginBottom: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.09)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
    overflow: "hidden",
    position: "relative",
  },
  wirdCardWatermark: {
    position: "absolute",
    fontSize: 90,
    opacity: 0.05,
    right: -5,
    top: -5,
  },
  wirdCardEmoji: { fontSize: 32, flexShrink: 0 },
  wirdCardTitle: { fontSize: 15, fontWeight: "900", color: C.white },
  wirdCardSubDone: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(0,245,160,0.85)",
    marginTop: 2,
  },
  wirdCardSubPending: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textMuted,
    marginTop: 2,
  },
  wirdRewardBadge: {
    backgroundColor: "rgba(0,245,160,0.2)",
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.mintBorder,
  },
  wirdRewardText: { fontSize: 12, fontWeight: "900", color: C.mint },
  wirdInProgressBadge: {
    backgroundColor: C.goldDim,
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  wirdInProgressText: { fontSize: 11, fontWeight: "800", color: C.gold },

  // ── Section Header ──
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: C.goldBorder,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: "900", color: C.white },
  sectionCountBadge: {
    backgroundColor: C.goldDim,
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: "900",
    color: C.gold,
  },

  // ── Earned Badges Grid ──
  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
  },
  earnedBadgeCard: {
    width: BADGE_SIZE,
    borderRadius: 22,
    padding: 13,
    alignItems: "center",
    gap: 7,
    borderWidth: 1.5,
    borderColor: C.goldBorder,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  earnedBadgeRing: {
    padding: 3,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.goldBorder,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  earnedBadgeCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  earnedBadgeIcon: { fontSize: 26 },
  earnedBadgeName: {
    fontSize: 11,
    fontWeight: "800",
    color: C.white,
    textAlign: "center",
    lineHeight: 15,
  },
  earnedPill: {
    backgroundColor: C.mintDim,
    borderRadius: 50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.mintBorder,
  },
  earnedPillText: { fontSize: 9, fontWeight: "800", color: C.mint },

  // ── Locked Badges ──
  lockedList: { paddingHorizontal: 16, gap: 8 },
  lockedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.07)",
  },
  lockedIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    flexShrink: 0,
  },
  lockedIconEmoji: { fontSize: 24, opacity: 0.4 },
  lockBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "rgba(13,16,64,1)",
    borderRadius: 8,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  lockedName: {
    fontSize: 13,
    fontWeight: "800",
    color: C.textSub,
    marginBottom: 7,
  },
  lockedBarBg: {
    height: 8,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 50,
    overflow: "hidden",
  },
  lockedBarFill: { height: "100%", borderRadius: 50 },
  lockedProgressPct: {
    fontSize: 10,
    fontWeight: "700",
    color: C.textMuted,
    marginTop: 4,
  },
  lockedPctPill: {
    backgroundColor: C.lavDim,
    borderRadius: 50,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.lavBorder,
  },
  lockedPctText: { fontSize: 11, fontWeight: "900", color: C.lavender },

  // ── Category Summary ──
  catSummaryCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: C.mintBorder,
    shadowColor: C.mint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  catSummaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  catSummaryLabel: { fontSize: 13, fontWeight: "800", color: C.white },
  catSummaryCount: { fontSize: 18, fontWeight: "900", color: C.mint },
  catSummaryBarBg: {
    height: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 50,
    overflow: "hidden",
  },
  catSummaryBarFill: {
    height: "100%",
    backgroundColor: C.mint,
    borderRadius: 50,
    shadowColor: C.mint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },

  // ── Category Grid ──
  catGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    gap: 10,
    marginBottom: 6,
    marginRight: 8,
  },
  catCard: {
    width: CAT_SIZE,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  catCardDim: { shadowOpacity: 0.05, elevation: 1 },
  catCardInner: {
    padding: 14,
    alignItems: "center",
    gap: 5,
    minHeight: 96,
    justifyContent: "center",
    position: "relative",
  },
  catShine: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
    transform: [{ translateX: -16 }, { translateY: -16 }],
  },
  catCardInnerLocked: {
    padding: 14,
    alignItems: "center",
    gap: 5,
    minHeight: 96,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    position: "relative",
  },
  catIcon: { fontSize: 26 },
  catName: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    lineHeight: 14,
  },
  catNameLocked: {
    fontSize: 10,
    fontWeight: "800",
    color: C.textMuted,
    textAlign: "center",
    lineHeight: 14,
  },
  catDoneCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 9,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  catLockMark: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Empty State ──
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyCircle: {
    width: 90,
    height: 90,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: C.goldBorder,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: C.white,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textMuted,
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 20,
  },
});
