import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { COLORS } from "@/constants/theme";
import { T } from "@/constants/translations";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { useKidStats } from "@/hooks/useKidStats";
import { useWird } from "@/hooks/useWird";
import { useCategories } from "@/hooks/useCategories";
import { supabase } from "@/services/supabase";
import { LinearGradient } from "expo-linear-gradient";

const DAYS_AR = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CATS_ICONS: Record<string, string> = {
  morning: "☀️",
  evening: "🌙",
  sleep: "😴",
  food: "🍽️",
  general: "✨",
  quran: "📖",
  prayer: "🕌",
  dua: "🤲",
  ruqyah: "🛡️",
};

const STAT_GRADIENTS: [string, string][] = [
  ["#EDE9FE", "#DDD6FE"],
  ["#FFF7ED", "#FED7AA"],
  ["#FEF3C7", "#FDE68A"],
  ["#ECFDF5", "#A7F3D0"],
  ["#FEF3C7", "#FCD34D"],
  ["#EDE9FE", "#C4B5FD"],
];

const STAT_COLORS = [
  "#7C3AED",
  "#EA580C",
  "#D97706",
  "#059669",
  "#B45309",
  "#7C3AED",
];

export default function MonitorScreen() {
  const { kids } = useAuth();
  const { lang } = useLang();
  const isRTL = lang === "ar";
  const t = T[lang];
  const days = isRTL ? DAYS_AR : DAYS_EN;

  const [selectedKid, setSelectedKid] = useState(0);
  const kid = kids[selectedKid] || kids[0];
  const kidId = kid?.id || null;

  const { stats } = useKidStats(kidId || undefined);
  const { items: wirdItems } = useWird(kidId);
  const { categories } = useCategories();

  const [weeklyData, setWeeklyData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [catProgress, setCatProgress] = useState<Record<string, number>>({});
  const [catTotals, setCatTotals] = useState<Record<string, number>>({});
  const [weeklyCompletedSum, setWeeklyCompletedSum] = useState(0);
  const [activeDaysCount, setActiveDaysCount] = useState(0);

  useEffect(() => {
    if (!kidId) return;
    fetchWeeklyData(kidId);
    fetchCatProgress(kidId);
  }, [kidId]);

  const fetchWeeklyData = async (kId: string) => {
    try {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 6);
      const from = weekAgo.toISOString().split("T")[0];
      const to = today.toISOString().split("T")[0];
      const { data } = await supabase
        .from("daily_goals")
        .select("goal_date, completed_count")
        .eq("kid_id", kId)
        .gte("goal_date", from)
        .lte("goal_date", to)
        .order("goal_date");
      const result = [0, 0, 0, 0, 0, 0, 0];
      let totalCompleted = 0;
      let daysWithActivity = 0;
      if (data) {
        data.forEach((r: any) => {
          const d = new Date(r.goal_date + "T00:00:00");
          const idx = d.getDay();
          result[idx] = r.completed_count || 0;
          totalCompleted += r.completed_count || 0;
          if (r.completed_count > 0) daysWithActivity++;
        });
      }
      setWeeklyData(result);
      setWeeklyCompletedSum(totalCompleted);
      setActiveDaysCount(daysWithActivity);
    } catch {}
  };

  const fetchCatProgress = async (kId: string) => {
    try {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 6);
      const from = weekAgo.toISOString().split("T")[0];
      const to = today.toISOString().split("T")[0];
      const { data: logs } = await supabase
        .from("wird_logs")
        .select("completed_items")
        .eq("kid_id", kId)
        .gte("log_date", from)
        .lte("log_date", to);
      const completedIds = new Set<number>();
      if (logs) {
        logs.forEach((log: any) => {
          const items = log.completed_items || [];
          items.forEach((item: any) => {
            if (item.adhkar_id) completedIds.add(Number(item.adhkar_id));
          });
        });
      }
      const { data: adhkarData } = await supabase
        .from("adhkar")
        .select("id, category_id, categories!adhkar_category_id_fkey(key)");
      const progress: Record<string, number> = {};
      const totals: Record<string, number> = {};
      if (adhkarData) {
        adhkarData.forEach((a: any) => {
          const catKey = a.categories?.key || String(a.category_id);
          totals[catKey] = (totals[catKey] || 0) + 1;
          if (completedIds.has(a.id))
            progress[catKey] = (progress[catKey] || 0) + 1;
        });
      }
      setCatProgress(progress);
      setCatTotals(totals);
    } catch {}
  };

  const wirdDone = wirdItems.filter((i: any) => i.is_completed).length;
  const wirdTotal = wirdItems.length;
  const wirdPct = wirdTotal > 0 ? Math.round((wirdDone / wirdTotal) * 100) : 0;
  const wirdComplete = wirdTotal > 0 && wirdDone >= wirdTotal;

  const maxBar = Math.max(...weeklyData, 1);
  const weeklyTotal = weeklyData.reduce((a, b) => a + b, 0);
  const daysActive = weeklyData.filter((d) => d > 0).length;
  const avgDaily = daysActive > 0 ? Math.round(weeklyTotal / daysActive) : 0;
  const bestDay = Math.max(...weeklyData);
  const todayIdx = new Date().getDay();

  return (
    <View style={{ flex: 1, backgroundColor: "#FFF7ED" }}>
      {/* ━━━ HERO HEADER ━━━ */}
      <LinearGradient
        colors={["#059669", "#10B981", "#34D399"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerWatermark}>📊</Text>
        <Text style={styles.headerTitle}>{t.monitorTab}</Text>
        <Text style={styles.headerSub}>
          {isRTL ? "تابع نشاط طفلك" : "Track your child's activity"}
        </Text>

        {/* Kid pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ paddingBottom: 10, direction: "ltr" }}
          contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
        >
          {kids.map((k: any, i: number) => {
            const active = selectedKid === i;
            const avatar = k.avatar || k.avatar_emoji || "🌟";
            return (
              <Pressable key={k.id} onPress={() => setSelectedKid(i)}>
                {active ? (
                  <LinearGradient
                    colors={["#F97316", "#FB923C"]}
                    style={styles.kidPillActive}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={{ fontSize: 18 }}>{avatar}</Text>
                    <Text style={styles.kidPillNameActive}>
                      {k.display_name || k.name}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.kidPill}>
                    <Text style={{ fontSize: 18 }}>{avatar}</Text>
                    <Text style={styles.kidPillName}>
                      {k.display_name || k.name}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ━━━ 6-STAT GRID ━━━ */}
        <View style={styles.statGrid}>
          {[
            {
              n: stats?.todayGoal?.completed_count ?? 0,
              l: isRTL ? "أذكار اليوم" : "Today",
              icon: "📿",
            },
            {
              n: kid?.streak || 0,
              l: t.streakLabel.replace(/ [🔥⭐]/, ""),
              icon: "🔥",
            },
            { n: kid?.stars || 0, l: isRTL ? "النجوم" : "Stars", icon: "⭐" },
            { n: kid?.total_adhkar || 0, l: t.totalAdhkar, icon: "📖" },
            {
              n: stats?.badgeCount ?? 0,
              l: isRTL ? "الشارات" : "Badges",
              icon: "🏅",
            },
            { n: stats?.friendCount ?? 0, l: t.friendsL, icon: "👥" },
          ].map((s, i) => (
            <LinearGradient
              key={i}
              colors={STAT_GRADIENTS[i]}
              style={styles.statBox}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={{ fontSize: 24 }}>{s.icon}</Text>
              <Text style={[styles.statNum, { color: STAT_COLORS[i] }]}>
                {s.n}
              </Text>
              <Text style={styles.statLabel}>{s.l}</Text>
            </LinearGradient>
          ))}
        </View>

        {/* ━━━ WIRD STATUS ━━━ */}
        <LinearGradient
          colors={
            wirdComplete ? ["#10B981", "#059669"] : ["#FFF7ED", "#FEF3C7"]
          }
          style={styles.wirdCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.wirdCardWatermark}>📿</Text>
          <View style={styles.wirdCardHeader}>
            <Text
              style={[styles.wirdCardTitle, wirdComplete && { color: "#fff" }]}
            >
              📿 {t.wirdStatus}
            </Text>
            <View
              style={[
                styles.wirdPctBadge,
                wirdComplete && { backgroundColor: "rgba(255,255,255,0.25)" },
              ]}
            >
              <Text
                style={[styles.wirdPctText, wirdComplete && { color: "#fff" }]}
              >
                {wirdComplete ? "✅ 100%" : `${wirdPct}%`}
              </Text>
            </View>
          </View>
          <View style={styles.wirdBarOuter}>
            <LinearGradient
              colors={
                wirdComplete
                  ? ["#fff", "rgba(255,255,255,0.8)"]
                  : ["#F97316", "#FBBF24"]
              }
              style={[styles.wirdBarFill, { width: `${wirdPct}%` }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
          <Text
            style={[
              styles.wirdCount,
              wirdComplete && { color: "rgba(255,255,255,0.9)" },
            ]}
          >
            {wirdComplete
              ? `🎉 ${wirdDone}/${wirdTotal} ${isRTL ? "مكتمل!" : "Complete!"}`
              : `${wirdDone}/${wirdTotal} ${isRTL ? "أذكار" : "dhikr"}`}
          </Text>
        </LinearGradient>

        {/* ━━━ WEEKLY ACTIVITY CHART ━━━ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📅 {t.activity}</Text>
          <View style={styles.chartRow}>
            {weeklyData.map((val, i) => {
              const isToday = i === todayIdx;
              const heightPct = Math.max((val / maxBar) * 100, 4);
              return (
                <View key={i} style={styles.chartCol}>
                  <Text
                    style={[
                      styles.chartVal,
                      { color: val > 0 ? "#7C3AED" : "#D1D5DB" },
                    ]}
                  >
                    {val > 0 ? val : ""}
                  </Text>
                  <View style={styles.barOuter}>
                    {val > 0 ? (
                      <LinearGradient
                        colors={
                          isToday
                            ? ["#F97316", "#FB923C"]
                            : ["#7C3AED", "#A78BFA"]
                        }
                        style={[styles.barInner, { height: `${heightPct}%` }]}
                      />
                    ) : (
                      <View
                        style={[
                          styles.barInner,
                          {
                            height: `${heightPct}%`,
                            backgroundColor: "#E5E7EB",
                          },
                        ]}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.dayText,
                      isToday && { color: "#F97316", fontWeight: "900" },
                    ]}
                  >
                    {days[i]}
                  </Text>
                  {isToday && <View style={styles.todayDot} />}
                </View>
              );
            })}
          </View>
        </View>

        {/* ━━━ WEEKLY REPORT ━━━ */}
        <LinearGradient
          colors={["#EDE9FE", "#DDD6FE"]}
          style={styles.reportCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.reportCardWatermark}>📋</Text>
          <Text style={styles.cardTitle}>
            📋 {isRTL ? "تقرير الأسبوع" : "Weekly Report"}
          </Text>
          <View style={styles.reportRow}>
            {[
              { n: avgDaily, l: t.avgDaily, emoji: "📊" },
              { n: bestDay, l: t.bestDay, emoji: "🏆" },
              { n: weeklyTotal, l: t.totalWeek, emoji: "📿" },
            ].map((r, i) => (
              <View key={i} style={styles.reportItem}>
                <Text style={{ fontSize: 24 }}>{r.emoji}</Text>
                <Text style={styles.reportNum}>{r.n}</Text>
                <Text style={styles.reportLabel}>{r.l}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* ━━━ CATEGORY PROGRESS ━━━ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.catProgress}</Text>
          {categories.slice(0, 6).map((c: any, idx: number) => {
            const key = c.key || c.id.toString();
            const catName = isRTL ? c.title_ar : c.title_en;
            const icon = c.icon || CATS_ICONS[key] || "📿";
            const done = catProgress[key] || 0;
            const total = catTotals[key] || 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const CAT_COLORS: [string, string][] = [
              ["#7C3AED", "#A78BFA"],
              ["#F97316", "#FB923C"],
              ["#10B981", "#34D399"],
              ["#D97706", "#FBBF24"],
              ["#7C3AED", "#C4B5FD"],
              ["#059669", "#6EE7B7"],
            ];
            const barColors = CAT_COLORS[idx % CAT_COLORS.length];
            return (
              <View key={key} style={styles.catRow}>
                <View
                  style={[
                    styles.catIconBubble,
                    { backgroundColor: `${barColors[0]}18` },
                  ]}
                >
                  <Text style={{ fontSize: 18 }}>{icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.catLabelRow}>
                    <Text style={styles.catName}>{catName}</Text>
                    <Text style={[styles.catPct, { color: barColors[0] }]}>
                      {pct}%
                    </Text>
                  </View>
                  <View style={styles.catBarOuter}>
                    <LinearGradient
                      colors={barColors}
                      style={[styles.catBarFill, { width: `${pct}%` }]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* ━━━ TIME SPENT ━━━ */}
        <LinearGradient
          colors={["#FEF3C7", "#FDE68A"]}
          style={styles.timeCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.timeCardWatermark}>⏱</Text>
          <Text style={[styles.cardTitle, { color: "#92400E" }]}>
            {t.timeSpent}
          </Text>
          <View style={styles.reportRow}>
            <View style={styles.timeItem}>
              <Text style={{ fontSize: 28 }}>📅</Text>
              <Text style={styles.timeNum}>
                {activeDaysCount > 0
                  ? `${Math.round((weeklyCompletedSum * 0.5) / activeDaysCount)}${isRTL ? "د" : "m"}`
                  : `0${isRTL ? "د" : "m"}`}
              </Text>
              <Text style={styles.timeLabel}>{t.avgSession}</Text>
            </View>
            <View style={styles.timeDivider} />
            <View style={styles.timeItem}>
              <Text style={{ fontSize: 28 }}>🗓</Text>
              <Text style={styles.timeNum}>
                {`${Math.round(weeklyCompletedSum * 0.5)}${isRTL ? "د" : "m"}`}
              </Text>
              <Text style={styles.timeLabel}>{t.totalTime}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 8,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
    position: "relative",
  },
  headerWatermark: {
    position: "absolute",
    fontSize: 130,
    opacity: 0.07,
    right: -10,
    top: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 2,
  },
  headerSub: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    marginBottom: 14,
  },

  kidPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  kidPillActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
  },
  kidPillName: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
  },
  kidPillNameActive: { fontSize: 13, fontWeight: "900", color: "#fff" },

  // Stat Grid
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  statBox: {
    width: "31%",
    borderRadius: 20,
    padding: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statNum: { fontSize: 22, fontWeight: "900", marginTop: 4 },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#78716C",
    marginTop: 2,
    textAlign: "center",
  },

  // Wird Card
  wirdCard: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  wirdCardWatermark: {
    position: "absolute",
    fontSize: 90,
    opacity: 0.07,
    right: -5,
    top: -5,
  },
  wirdCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  wirdCardTitle: { fontSize: 15, fontWeight: "900", color: "#92400E" },
  wirdPctBadge: {
    backgroundColor: "rgba(245,158,11,0.15)",
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  wirdPctText: { fontSize: 13, fontWeight: "900", color: "#D97706" },
  wirdBarOuter: {
    height: 12,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderRadius: 50,
    overflow: "hidden",
    marginBottom: 8,
  },
  wirdBarFill: { height: "100%", borderRadius: 50 },
  wirdCount: { fontSize: 13, fontWeight: "800", color: "#92400E" },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1C1917",
    marginBottom: 14,
  },

  // Chart
  chartRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 130,
  },
  chartCol: {
    alignItems: "center",
    flex: 1,
    height: "100%",
    position: "relative",
  },
  chartVal: { fontSize: 10, fontWeight: "800", marginBottom: 4, height: 14 },
  barOuter: {
    flex: 1,
    width: 22,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    justifyContent: "flex-end",
    overflow: "hidden",
    marginBottom: 6,
  },
  barInner: { width: "100%", borderRadius: 10 },
  dayText: { fontSize: 10, fontWeight: "700", color: "#A8A29E" },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F97316",
    marginTop: 3,
  },

  // Report Card
  reportCard: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  reportCardWatermark: {
    position: "absolute",
    fontSize: 90,
    opacity: 0.07,
    right: -5,
    top: -5,
  },
  reportRow: { flexDirection: "row", justifyContent: "space-around" },
  reportItem: { alignItems: "center", gap: 4 },
  reportNum: { fontSize: 24, fontWeight: "900", color: "#7C3AED" },
  reportLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#78716C",
    textAlign: "center",
  },

  // Category Progress
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  catIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  catLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  catName: { fontSize: 13, fontWeight: "800", color: "#1C1917" },
  catPct: { fontSize: 12, fontWeight: "900" },
  catBarOuter: {
    height: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 50,
    overflow: "hidden",
  },
  catBarFill: { height: "100%", borderRadius: 50 },

  // Time Card
  timeCard: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  timeCardWatermark: {
    position: "absolute",
    fontSize: 90,
    opacity: 0.07,
    right: -5,
    top: -5,
  },
  timeItem: { flex: 1, alignItems: "center", gap: 4 },
  timeNum: { fontSize: 26, fontWeight: "900", color: "#92400E" },
  timeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A16207",
    textAlign: "center",
  },
  timeDivider: {
    width: 1,
    height: 60,
    backgroundColor: "rgba(146,64,14,0.15)",
    alignSelf: "center",
  },
});
