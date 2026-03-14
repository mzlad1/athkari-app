import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useState, useCallback, useRef } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { notificationService } from "@/services/notifications";
import { NotificationsSkeleton } from "@/components/ui/Skeleton";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#06091E",
  bgCard: "rgba(255,255,255,0.04)",
  bgCardBorder: "rgba(255,255,255,0.08)",
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
  textSub: "rgba(255,255,255,0.62)",
};

// Each notification type gets a color accent from the design system
const TYPE_CONFIG: Record<
  string,
  { icon: string; accentColor: string; accentDim: string; accentBorder: string }
> = {
  friend_request: {
    icon: "👥",
    accentColor: C.lavender,
    accentDim: C.lavDim,
    accentBorder: C.lavBorder,
  },
  friend_accepted: {
    icon: "🎉",
    accentColor: C.mint,
    accentDim: C.mintDim,
    accentBorder: C.mintBorder,
  },
  reaction: {
    icon: "💬",
    accentColor: C.gold,
    accentDim: C.goldDim,
    accentBorder: C.goldBorder,
  },
  challenge_invite: {
    icon: "⚔️",
    accentColor: C.coral,
    accentDim: C.coralDim,
    accentBorder: C.coralBorder,
  },
  challenge_accepted: {
    icon: "✅",
    accentColor: C.mint,
    accentDim: C.mintDim,
    accentBorder: C.mintBorder,
  },
  challenge_won: {
    icon: "🏆",
    accentColor: C.gold,
    accentDim: C.goldDim,
    accentBorder: C.goldBorder,
  },
  badge_earned: {
    icon: "🏅",
    accentColor: C.gold,
    accentDim: C.goldDim,
    accentBorder: C.goldBorder,
  },
  wird_complete: {
    icon: "📖",
    accentColor: C.mint,
    accentDim: C.mintDim,
    accentBorder: C.mintBorder,
  },
  category_complete: {
    icon: "✅",
    accentColor: C.cyan,
    accentDim: C.cyanDim,
    accentBorder: C.cyanBorder,
  },
  referral_bonus: {
    icon: "🎁",
    accentColor: C.coral,
    accentDim: C.coralDim,
    accentBorder: C.coralBorder,
  },
  level_up: {
    icon: "🎉",
    accentColor: C.lavender,
    accentDim: C.lavDim,
    accentBorder: C.lavBorder,
  },
};

const DEFAULT_CONFIG = {
  icon: "🔔",
  accentColor: C.cyan,
  accentDim: C.cyanDim,
  accentBorder: C.cyanBorder,
};

const PAGE_SIZE = 20;
type Filter = "all" | "unread" | "read";

export default function NotificationsScreen() {
  const router = useRouter();
  const { activeKid } = useAuth();
  const { lang } = useLang();
  const isRTL = lang === "ar";
  const kidId = activeKid?.id || null;

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const prevUnreadCount = useRef(0);
  const markAllScale = useRef(new Animated.Value(1)).current;

  const loadNotifications = useCallback(
    async (reset = true) => {
      if (!kidId) return;
      if (reset) setLoading(true);
      try {
        const data = await notificationService.getKidNotifications(
          kidId,
          PAGE_SIZE,
          0,
          filter,
        );
        const newUnread = data.filter((n: any) => !n.read).length;
        if (
          reset &&
          newUnread > prevUnreadCount.current &&
          prevUnreadCount.current >= 0
        ) {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          ).catch(() => {});
        }
        prevUnreadCount.current = newUnread;
        setNotifications(data);
        setHasMore(data.length >= PAGE_SIZE);
      } catch {}
      setLoading(false);
    },
    [kidId, filter],
  );

  useFocusEffect(
    useCallback(() => {
      loadNotifications(true);
    }, [loadNotifications]),
  );

  const loadMore = async () => {
    if (loadingMore || !hasMore || !kidId) return;
    setLoadingMore(true);
    try {
      const data = await notificationService.getKidNotifications(
        kidId,
        PAGE_SIZE,
        notifications.length,
        filter,
      );
      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const unique = data.filter((n: any) => !existingIds.has(n.id));
        return [...prev, ...unique];
      });
      setHasMore(data.length >= PAGE_SIZE);
    } catch {}
    setLoadingMore(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications(true);
    setRefreshing(false);
  }, [loadNotifications]);

  const handleMarkRead = async () => {
    Animated.sequence([
      Animated.spring(markAllScale, {
        toValue: 0.93,
        useNativeDriver: true,
      }),
      Animated.spring(markAllScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    if (!kidId) return;
    await notificationService.markAllRead(kidId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleFilterChange = (f: Filter) => {
    if (f === filter) return;
    setFilter(f);
    setNotifications([]);
    setHasMore(true);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return isRTL ? `${mins} د` : `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return isRTL ? `${hrs} س` : `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return isRTL ? `${days} يوم` : `${days}d`;
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const FILTERS: { key: Filter; labelAr: string; labelEn: string }[] = [
    { key: "all", labelAr: "الكل", labelEn: "All" },
    { key: "unread", labelAr: "غير مقروء", labelEn: "Unread" },
    { key: "read", labelAr: "مقروء", labelEn: "Read" },
  ];

  const renderNotification = ({ item: n }: { item: any }) => {
    const cfg = TYPE_CONFIG[n.type] || DEFAULT_CONFIG;
    return (
      <View
        style={[
          styles.notifCard,
          !n.read && {
            borderColor: cfg.accentBorder,
            shadowColor: cfg.accentColor,
            shadowOpacity: 0.2,
          },
        ]}
      >
        {!n.read && (
          <View
            style={[styles.unreadStrip, { backgroundColor: cfg.accentColor }]}
          />
        )}
        <View
          style={[
            styles.iconCircle,
            !n.read && {
              backgroundColor: cfg.accentDim,
              borderColor: cfg.accentBorder,
            },
          ]}
        >
          <Text style={styles.notifIcon}>{cfg.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.notifTitle,
              !n.read && { color: C.white, fontWeight: "900" },
            ]}
          >
            {isRTL ? n.title_ar : n.title_en}
          </Text>
          <Text style={styles.notifBody}>{isRTL ? n.body_ar : n.body_en}</Text>
        </View>
        <View style={styles.notifRight}>
          <Text
            style={[styles.notifTime, !n.read && { color: cfg.accentColor }]}
          >
            {n.created_at ? timeAgo(n.created_at) : ""}
          </Text>
          {!n.read && (
            <View
              style={[styles.unreadDot, { backgroundColor: cfg.accentColor }]}
            />
          )}
        </View>
      </View>
    );
  };

  const ListHeader = (
    <>
      {/* ━━━ HEADER ━━━ */}
      <LinearGradient
        colors={["#0D1040", "#06091E"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerBlob} />
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{isRTL ? "→" : "←"}</Text>
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerLabel}>
            {isRTL ? "مركز الإشعارات" : "Notification Center"}
          </Text>
          <Text style={styles.title}>
            🔔 {isRTL ? "الإشعارات" : "Notifications"}
          </Text>
          {unreadCount > 0 && (
            <View style={styles.unreadPill}>
              <Text style={styles.unreadPillText}>
                {unreadCount} {isRTL ? "جديد" : "new"}
              </Text>
            </View>
          )}
        </View>

        {unreadCount > 0 && (
          <Animated.View style={{ transform: [{ scale: markAllScale }] }}>
            <Pressable onPress={handleMarkRead} style={styles.markAllBtn}>
              <LinearGradient
                colors={["#FF6B9D", "#FFD60A"]}
                style={styles.markAllInner}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.markAllText}>
                  ✓ {isRTL ? "قراءة الكل" : "Mark all"}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}
      </LinearGradient>

      {/* ━━━ FILTER TABS ━━━ */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => handleFilterChange(f.key)}
              style={[styles.filterTab, active && styles.filterTabActive]}
            >
              <Text
                style={[
                  styles.filterTabText,
                  active && styles.filterTabTextActive,
                ]}
              >
                {isRTL ? f.labelAr : f.labelEn}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading && <NotificationsSkeleton />}
    </>
  );

  const ListFooter = (
    <>
      {loadingMore && (
        <View style={styles.loadingMore}>
          <ActivityIndicator color={C.cyan} size="small" />
        </View>
      )}
      {!hasMore && notifications.length > 0 && (
        <Text style={styles.endText}>
          {isRTL ? "لا مزيد من الإشعارات" : "No more notifications"}
        </Text>
      )}
    </>
  );

  const ListEmpty = !loading ? (
    <View style={styles.emptyState}>
      <LinearGradient
        colors={["#1C1000", "#2E1A00"]}
        style={styles.emptyCircle}
      >
        <Text style={{ fontSize: 48 }}>🔔</Text>
      </LinearGradient>
      <Text style={styles.emptyTitle}>
        {isRTL ? "لا إشعارات جديدة" : "All caught up!"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {isRTL ? "ستظهر إشعاراتك هنا" : "Your notifications will appear here"}
      </Text>
    </View>
  ) : null;

  return (
    <View style={styles.bg}>
      {/* Micro stars */}
      {[
        { top: 60, left: 30, s: 2.5 },
        { top: 120, right: 50, s: 2 },
        { top: 200, left: 80, s: 1.5 },
        { top: 350, right: 40, s: 2 },
      ].map((st, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: st.top,
            left: (st as any).left,
            right: (st as any).right,
            width: st.s,
            height: st.s,
            borderRadius: st.s,
            backgroundColor: "#fff",
            opacity: 0.3,
          }}
        />
      ))}

      <FlatList
        data={loading ? [] : notifications}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderNotification}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.content}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.cyan}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 40, paddingHorizontal: 16 },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 22,
    gap: 12,
    position: "relative",
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
    marginBottom: 16,
  },
  headerBlob: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(179,136,255,0.07)",
    top: -80,
    right: -40,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.bgCardBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  backText: { fontSize: 20, color: C.white, fontWeight: "800" },
  headerLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: C.cyan,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: C.white,
  },
  unreadPill: {
    alignSelf: "flex-start",
    marginTop: 5,
    backgroundColor: C.coralDim,
    borderRadius: 50,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: C.coralBorder,
  },
  unreadPillText: { fontSize: 11, fontWeight: "800", color: C.coral },
  markAllBtn: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 2,
  },
  markAllInner: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  markAllText: { fontSize: 12, fontWeight: "800", color: "#fff" },

  // ── Filters ──
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.bgCardBorder,
    alignItems: "center",
  },
  filterTabActive: {
    backgroundColor: C.cyanDim,
    borderColor: C.cyanBorder,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "800",
    color: C.textMuted,
  },
  filterTabTextActive: {
    color: C.cyan,
  },

  // ── List ──

  // ── Notification Card ──
  notifCard: {
    backgroundColor: C.bgCard,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: C.bgCardBorder,

    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  unreadStrip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3.5,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notifIcon: { fontSize: 26 },
  notifTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textSub,
    marginBottom: 3,
  },
  notifBody: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textMuted,
    lineHeight: 17,
  },
  notifRight: {
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  notifTime: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textMuted,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // ── Loading / End ──
  loadingMore: {
    paddingVertical: 20,
    alignItems: "center",
  },
  endText: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: C.textMuted,
    paddingVertical: 16,
  },

  // ── Empty State ──
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyCircle: {
    width: 96,
    height: 96,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: C.goldBorder,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: C.white,
    marginBottom: 7,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textMuted,
    textAlign: "center",
  },
});
