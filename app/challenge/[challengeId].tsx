import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { Animated } from "react-native";
import { COLORS } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { challengesService } from "@/services/challenges";
import { supabase } from "@/services/supabase";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { T } from "@/constants/translations";
import { CelebrationOverlay } from "@/components/gamification/CelebrationOverlay";
import type { CelebrationType } from "@/components/gamification/CelebrationOverlay";

const { width: SW } = Dimensions.get("window");
const CIRCLE = 180;

// ─── Design Tokens ────────────────────────────────────────────────────────────
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
  white: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.4)",
  textSub: "rgba(255,255,255,0.65)",
};

export default function ChallengePlayScreen() {
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const { activeKid } = useAuth();
  const { lang } = useLang();
  const isRTL = lang === "ar";
  const t = T[lang];
  const kidId = activeKid?.id || null;
  const cId = parseInt(challengeId || "0");

  const [challenge, setChallenge] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [myCount, setMyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tapping, setTapping] = useState(false);
  const [showCeleb, setShowCeleb] = useState(false);
  const tapScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  const is1v1 = challenge?.type === "1v1";
  const totalProgress = participants.reduce(
    (s: number, p: any) => s + Math.max(0, p.contribution || 0),
    0,
  );
  const daysLeft = challenge
    ? Math.max(
        0,
        Math.ceil(
          (new Date(challenge.end_date).getTime() - Date.now()) / 86400000,
        ),
      )
    : 0;
  const isEnded = challenge?.status === "completed" || daysLeft <= 0;
  const progressPct = challenge?.goal
    ? Math.min(100, (totalProgress / challenge.goal) * 100)
    : 0;

  // Pulse + glow animations for tap button
  useEffect(() => {
    if (isEnded) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    glow.start();
    return () => {
      pulse.stop();
      glow.stop();
    };
  }, [isEnded]);

  const loadChallenge = useCallback(async () => {
    if (!cId) return;
    try {
      const data = await challengesService.getChallenge(cId);
      setChallenge(data);
      const parts = data?.challenge_participants || [];
      setParticipants(parts);
      const me = parts.find((p: any) => p.kid_id === kidId);
      if (me) setMyCount(Math.max(0, me.contribution || 0));
      if (data?.status === "completed") setShowCeleb(true);
    } catch {}
    setLoading(false);
  }, [cId, kidId]);

  useEffect(() => {
    loadChallenge();
  }, [loadChallenge]);

  useEffect(() => {
    if (!challenge || challenge.status !== "completed") return;
    setShowCeleb(true);
  }, [challenge?.status]);

  useEffect(() => {
    if (!cId || !kidId || challenge?.status === "completed") return;
    const interval = setInterval(async () => {
      try {
        const data = await challengesService.getChallenge(cId);
        if (data?.status === "completed") {
          setChallenge(data);
          setShowCeleb(true);
        }
      } catch {}
    }, 4000);
    return () => clearInterval(interval);
  }, [cId, kidId, challenge?.status]);

  useEffect(() => {
    if (!cId) return;
    const channel = supabase
      .channel(`challenge-${cId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "challenge_participants",
          filter: `challenge_id=eq.${cId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setParticipants((prev) =>
            prev.map((p) =>
              p.kid_id === updated.kid_id
                ? { ...p, contribution: updated.contribution }
                : p,
            ),
          );
          if (updated.kid_id === kidId)
            setMyCount(Math.max(0, updated.contribution || 0));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "challenges",
          filter: `id=eq.${cId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setChallenge((prev: any) => (prev ? { ...prev, ...updated } : prev));
          if (updated.status === "completed") setShowCeleb(true);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [cId, kidId]);

  const handleTap = async () => {
    if (!kidId || !cId || tapping || isEnded) return;
    setTapping(true);
    setMyCount((c) => c + 1);
    setParticipants((prev) =>
      prev.map((p) =>
        p.kid_id === kidId
          ? { ...p, contribution: (p.contribution || 0) + 1 }
          : p,
      ),
    );

    Animated.sequence([
      Animated.timing(tapScale, {
        toValue: 0.88,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.spring(tapScale, {
        toValue: 1,
        tension: 220,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    try {
      await challengesService.tapDhikr(cId, kidId);
    } catch {
      setMyCount((c) => Math.max(0, c - 1));
    }
    setTapping(false);
  };

  // ── Loading ──
  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: C.bg }]}>
        <Text style={{ fontSize: 44 }}>⏳</Text>
        <Text style={s.loadingText}>
          {isRTL ? "جاري التحميل..." : "Loading..."}
        </Text>
      </View>
    );
  }

  // ── Not found ──
  if (!challenge) {
    return (
      <View style={[s.centered, { backgroundColor: C.bg }]}>
        <Text style={{ fontSize: 44 }}>😕</Text>
        <Text style={s.loadingText}>
          {isRTL ? "التحدي غير موجود" : "Challenge not found"}
        </Text>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>← {isRTL ? "العودة" : "Back"}</Text>
        </Pressable>
      </View>
    );
  }

  const opponent = is1v1
    ? participants.find((p: any) => p.kid_id !== kidId)
    : null;
  const opCount = Math.max(0, opponent?.contribution || 0);
  const opKid = opponent?.kids;

  const sortedLeaderboard = [...participants]
    .filter((p: any) => (p.contribution || 0) >= 0)
    .sort((a: any, b: any) => (b.contribution || 0) - (a.contribution || 0));

  const myRank =
    sortedLeaderboard.findIndex((p: any) => p.kid_id === kidId) + 1;
  const isWinning1v1 = is1v1 && myCount > opCount;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Background star dots */}
      {[
        { top: 80, left: 30, s: 2.5 },
        { top: 140, right: 50, s: 2 },
        { top: 220, left: 80, s: 1.5 },
        { top: 300, right: 120, s: 3 },
        { top: 400, left: 40, s: 2 },
        { top: 500, right: 60, s: 1.5 },
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
            opacity: 0.35,
          }}
        />
      ))}

      {showCeleb && (
        <CelebrationOverlay
          type={(challenge.celebration_type as CelebrationType) || "confetti"}
          title={isRTL ? "🎉 انتهى التحدي!" : "🎉 Challenge Complete!"}
          subtitle={
            myRank <= 3
              ? isRTL
                ? `🏆 المركز ${myRank} — +${challenge.reward_stars || 0}⭐`
                : `🏆 Rank #${myRank} — +${challenge.reward_stars || 0}⭐`
              : isRTL
                ? challenge.name_ar
                : challenge.name_en
          }
          stars={challenge.reward_stars}
          isRTL={isRTL}
          autoDismissMs={4000}
          onDismiss={() => {
            setShowCeleb(false);
            router.back();
          }}
        />
      )}

      {/* ━━━ HEADER ━━━ */}
      <LinearGradient
        colors={["#0D1040", "#06091E"]}
        style={s.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Pressable onPress={() => router.back()} style={s.headerBtn}>
          <Text style={s.headerBtnText}>←</Text>
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>
          {isRTL ? challenge.name_ar : challenge.name_en}
        </Text>
        <View
          style={[
            s.timerBadge,
            isEnded && {
              backgroundColor: C.coralDim,
              borderColor: C.coralBorder,
            },
          ]}
        >
          <Text style={[s.timerText, isEnded && { color: C.coral }]}>
            {isEnded ? (isRTL ? "⏹ انتهى" : "⏹ Ended") : `⏰ ${daysLeft}d`}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ━━━ 1v1 VS SECTION ━━━ */}
        {is1v1 && (
          <LinearGradient
            colors={["#0D0033", "#1A0055"]}
            style={s.vsCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={s.vsCardWatermark}>⚔️</Text>

            <View style={s.vsRow}>
              {/* Me */}
              <View style={s.vsPlayer}>
                <LinearGradient
                  colors={
                    isWinning1v1
                      ? [C.cyan, C.lavender]
                      : [C.bgCard, "rgba(255,255,255,0.03)"]
                  }
                  style={[
                    s.vsAvatarRing,
                    isWinning1v1 && {
                      shadowColor: C.cyan,
                      shadowOpacity: 0.5,
                      shadowRadius: 12,
                      elevation: 8,
                    },
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={s.vsAvatarInner}>
                    <Text style={s.vsAvatarEmoji}>
                      {activeKid?.avatar || "🌟"}
                    </Text>
                  </View>
                </LinearGradient>
                <Text style={s.vsName}>{activeKid?.name || t.me}</Text>
                <View
                  style={[
                    s.vsScorePill,
                    isWinning1v1 && {
                      backgroundColor: C.cyanDim,
                      borderColor: C.cyanBorder,
                    },
                  ]}
                >
                  <Text style={[s.vsScore, isWinning1v1 && { color: C.cyan }]}>
                    {myCount}
                  </Text>
                </View>
                {isWinning1v1 && (
                  <View style={s.vsWinBadge}>
                    <Text style={s.vsWinText}>
                      🏆 {isRTL ? "تتقدم!" : "Winning!"}
                    </Text>
                  </View>
                )}
              </View>

              {/* VS Badge */}
              <View style={s.vsBadge}>
                <LinearGradient
                  colors={[C.lavDim, C.cyanDim]}
                  style={s.vsBadgeInner}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={s.vsText}>⚔️</Text>
                  <Text style={s.vsLabel}>VS</Text>
                </LinearGradient>
              </View>

              {/* Opponent */}
              <View style={s.vsPlayer}>
                <LinearGradient
                  colors={
                    !isWinning1v1 && opCount > myCount
                      ? [C.gold, "#FF9100"]
                      : [C.bgCard, "rgba(255,255,255,0.03)"]
                  }
                  style={[
                    s.vsAvatarRing,
                    !isWinning1v1 &&
                      opCount > myCount && {
                        shadowColor: C.gold,
                        shadowOpacity: 0.45,
                        shadowRadius: 12,
                        elevation: 8,
                      },
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={s.vsAvatarInner}>
                    <Text style={s.vsAvatarEmoji}>{opKid?.avatar || "🌟"}</Text>
                  </View>
                </LinearGradient>
                <Text style={s.vsName}>{opKid?.name || "?"}</Text>
                <View style={[s.vsScorePill, { borderColor: C.goldBorder }]}>
                  <Text style={[s.vsScore, { color: C.gold }]}>{opCount}</Text>
                </View>
                {opCount > myCount && (
                  <View
                    style={[
                      s.vsWinBadge,
                      {
                        backgroundColor: C.goldDim,
                        borderColor: C.goldBorder,
                      },
                    ]}
                  >
                    <Text style={[s.vsWinText, { color: C.gold }]}>
                      🏆 {isRTL ? "يتقدم!" : "Leading!"}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* VS bar */}
            <View style={s.vsBarWrap}>
              <View style={s.vsBar}>
                <View style={[s.vsBarMe, { flex: myCount || 0.5 }]} />
                <View style={[s.vsBarOp, { flex: opCount || 0.5 }]} />
              </View>
            </View>
          </LinearGradient>
        )}

        {/* ━━━ COMMUNITY PROGRESS ━━━ */}
        {!is1v1 && (
          <LinearGradient
            colors={["#0D0033", "#1A0055"]}
            style={s.progressCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={s.progressCardWatermark}>🌍</Text>
            <View style={s.progressHeader}>
              <Text style={s.progressTitle}>
                🌍 {isRTL ? "التقدم الجماعي" : "Team Progress"}
              </Text>
              <View style={s.progressScorePill}>
                <Text style={s.progressScore}>
                  {totalProgress} / {challenge.goal || 0}
                </Text>
              </View>
            </View>

            <View style={s.progressBarOuter}>
              <LinearGradient
                colors={
                  progressPct >= 100
                    ? [C.mint, "#00C97A"]
                    : [C.lavender, C.cyan]
                }
                style={[s.progressBarFill, { width: `${progressPct}%` as any }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </View>
            <Text style={s.progressPct}>{Math.round(progressPct)}%</Text>

            <View style={s.myStatsRow}>
              <View style={s.myStatPill}>
                <Text style={s.myStatText}>
                  🤲 {isRTL ? `مساهمتك: ${myCount}` : `You: ${myCount}`}
                </Text>
              </View>
              {myRank > 0 && (
                <View
                  style={[
                    s.myStatPill,
                    { backgroundColor: C.goldDim, borderColor: C.goldBorder },
                  ]}
                >
                  <Text style={[s.myStatText, { color: C.gold }]}>
                    🏅 {isRTL ? `#${myRank}` : `Rank #${myRank}`}
                  </Text>
                </View>
              )}
            </View>
          </LinearGradient>
        )}

        {/* ━━━ DHIKR TEXT ━━━ */}
        <View style={s.dhikrCard}>
          <View style={s.dhikrGlow} />
          <Text style={s.dhikrText}>{challenge.dhikr_text_ar}</Text>
          {challenge.dhikr_text_en && (
            <Text style={s.dhikrTextEn}>{challenge.dhikr_text_en}</Text>
          )}
        </View>

        {/* ━━━ TAP CIRCLE ━━━ */}
        <View style={s.circleWrap}>
          {/* Outer animated glow ring */}
          <Animated.View
            style={[
              s.tapRingOuter,
              {
                transform: [{ scale: isEnded ? 1 : pulseAnim }],
                opacity: isEnded ? 0.15 : glowAnim,
              },
            ]}
          />
          {/* Middle ring */}
          <View style={s.tapRingMiddle} />

          <Pressable onPress={handleTap} disabled={isEnded}>
            <Animated.View style={{ transform: [{ scale: tapScale }] }}>
              <LinearGradient
                colors={
                  isEnded
                    ? ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.02)"]
                    : [C.lavender, C.cyan]
                }
                style={[
                  s.tapCircle,
                  {
                    shadowColor: isEnded ? "transparent" : C.cyan,
                  },
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {/* Inner dark circle for contrast */}
                <View style={s.tapCircleInner}>
                  <Text style={s.tapCount}>{myCount}</Text>
                  <Text style={s.tapLabel}>
                    {isEnded
                      ? isRTL
                        ? "⏹ انتهى"
                        : "⏹ Ended"
                      : isRTL
                        ? "👆 اضغط"
                        : "👆 Tap!"}
                  </Text>
                </View>
              </LinearGradient>
            </Animated.View>
          </Pressable>

          {!isEnded && (
            <Text style={s.tapHint}>
              {isRTL ? "اضغط لتسبيح!" : "Tap to count!"}
            </Text>
          )}
        </View>

        {/* ━━━ LEADERBOARD (community) ━━━ */}
        {!is1v1 && sortedLeaderboard.length > 0 && (
          <LinearGradient
            colors={["rgba(179,136,255,0.06)", "rgba(0,229,255,0.04)"]}
            style={s.leaderCard}
          >
            <Text style={s.leaderCardWatermark}>🏆</Text>
            <Text style={s.leaderTitle}>
              🏆 {isRTL ? "الترتيب" : "Leaderboard"}
            </Text>

            {/* Sticky me row if not in top 3 */}
            {myRank > 3 &&
              (() => {
                const meEntry = sortedLeaderboard.find(
                  (p: any) => p.kid_id === kidId,
                );
                if (!meEntry) return null;
                return (
                  <LinearGradient
                    colors={[C.cyanDim, C.lavDim]}
                    style={[s.leaderRow, s.leaderRowMe, { marginBottom: 8 }]}
                  >
                    <Text style={s.leaderRankText}>#{myRank}</Text>
                    <Text style={s.leaderAvatarText}>
                      {activeKid?.avatar || "🌟"}
                    </Text>
                    <Text style={[s.leaderName, { color: C.cyan }]}>
                      {activeKid?.name || "?"} ({t.me})
                    </Text>
                    <View
                      style={[
                        s.leaderScorePill,
                        {
                          backgroundColor: C.cyanDim,
                          borderColor: C.cyanBorder,
                        },
                      ]}
                    >
                      <Text style={[s.leaderScore, { color: C.cyan }]}>
                        {meEntry.contribution || 0}
                      </Text>
                    </View>
                  </LinearGradient>
                );
              })()}

            {sortedLeaderboard.map((p: any, i: number) => {
              const isMe = p.kid_id === kidId;
              if (isMe && myRank > 3) return null;
              const rankEmoji =
                i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;

              return isMe ? (
                <LinearGradient
                  key={p.kid_id}
                  colors={[C.cyanDim, C.lavDim]}
                  style={[s.leaderRow, s.leaderRowMe]}
                >
                  <Text style={s.leaderRankText}>
                    {rankEmoji || `#${i + 1}`}
                  </Text>
                  <Text style={s.leaderAvatarText}>
                    {p.kids?.avatar || "🌟"}
                  </Text>
                  <Text style={[s.leaderName, { color: C.cyan }]}>
                    {p.kids?.name || "?"} ({t.me})
                  </Text>
                  <View
                    style={[
                      s.leaderScorePill,
                      {
                        backgroundColor: C.cyanDim,
                        borderColor: C.cyanBorder,
                      },
                    ]}
                  >
                    <Text style={[s.leaderScore, { color: C.cyan }]}>
                      {p.contribution || 0}
                    </Text>
                  </View>
                </LinearGradient>
              ) : (
                <View key={p.kid_id} style={s.leaderRow}>
                  <Text style={s.leaderRankText}>
                    {rankEmoji || `#${i + 1}`}
                  </Text>
                  <Text style={s.leaderAvatarText}>
                    {p.kids?.avatar || "🌟"}
                  </Text>
                  <Text style={s.leaderName}>{p.kids?.name || "?"}</Text>
                  <View style={s.leaderScorePill}>
                    <Text style={s.leaderScore}>{p.contribution || 0}</Text>
                  </View>
                </View>
              );
            })}
          </LinearGradient>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: C.bg,
  },
  loadingText: {
    color: C.textSub,
    fontSize: 16,
    fontWeight: "700",
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.bgCardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnText: { color: C.white, fontSize: 18, fontWeight: "800" },
  headerTitle: {
    flex: 1,
    color: C.white,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  timerBadge: {
    backgroundColor: C.goldDim,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  timerText: { color: C.gold, fontSize: 12, fontWeight: "800" },

  content: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // ── VS Card ──
  vsCard: {
    width: "100%",
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1.5,
    borderColor: C.lavBorder,
    shadowColor: C.lavender,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  vsCardWatermark: {
    position: "absolute",
    fontSize: 110,
    opacity: 0.05,
    right: -5,
    top: -10,
  },
  vsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  vsPlayer: { flex: 1, alignItems: "center", gap: 8 },
  vsAvatarRing: {
    width: 76,
    height: 76,
    borderRadius: 24,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  vsAvatarInner: {
    width: 68,
    height: 68,
    borderRadius: 21,
    backgroundColor: "rgba(6,9,30,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  vsAvatarEmoji: { fontSize: 38 },
  vsName: {
    color: C.textSub,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  vsScorePill: {
    backgroundColor: C.bgCard,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 7,
    minWidth: 60,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: C.cyanBorder,
  },
  vsScore: { color: C.cyan, fontSize: 28, fontWeight: "900" },
  vsWinBadge: {
    backgroundColor: C.cyanDim,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.cyanBorder,
  },
  vsWinText: { fontSize: 10, fontWeight: "900", color: C.cyan },
  vsBadge: { alignItems: "center", justifyContent: "center" },
  vsBadgeInner: {
    width: 54,
    height: 54,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: C.lavBorder,
  },
  vsText: { fontSize: 18 },
  vsLabel: { color: C.textMuted, fontSize: 9, fontWeight: "900" },
  vsBarWrap: { marginTop: 14 },
  vsBar: {
    flexDirection: "row",
    height: 8,
    borderRadius: 50,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  vsBarMe: { backgroundColor: C.cyan, borderRadius: 50 },
  vsBarOp: { backgroundColor: C.gold, borderRadius: 50 },

  // ── Community Progress Card ──
  progressCard: {
    width: "100%",
    borderRadius: 28,
    padding: 18,
    marginBottom: 16,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1.5,
    borderColor: C.lavBorder,
    shadowColor: C.lavender,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },
  progressCardWatermark: {
    position: "absolute",
    fontSize: 90,
    opacity: 0.05,
    right: 8,
    top: 4,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  progressTitle: { fontSize: 15, fontWeight: "900", color: C.white },
  progressScorePill: {
    backgroundColor: C.goldDim,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  progressScore: { fontSize: 13, fontWeight: "900", color: C.gold },
  progressBarOuter: {
    height: 13,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 50,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressBarFill: { height: "100%", borderRadius: 50 },
  progressPct: {
    fontSize: 11,
    fontWeight: "800",
    color: C.textMuted,
    textAlign: "right",
  },
  myStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  myStatPill: {
    backgroundColor: C.lavDim,
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.lavBorder,
  },
  myStatText: {
    fontSize: 12,
    fontWeight: "800",
    color: C.lavender,
  },

  // ── Dhikr Card ──
  dhikrCard: {
    width: "100%",
    backgroundColor: C.bgCard,
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: C.bgCardBorder,
    position: "relative",
    overflow: "hidden",
  },
  dhikrGlow: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(179,136,255,0.08)",
    top: -40,
    alignSelf: "center",
  },
  dhikrText: {
    fontSize: 28,
    fontWeight: "900",
    color: C.white,
    textAlign: "center",
    lineHeight: 46,
    marginBottom: 8,
  },
  dhikrTextEn: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textMuted,
    textAlign: "center",
    fontStyle: "italic",
  },

  // ── Tap Circle ──
  circleWrap: {
    marginVertical: 12,
    alignItems: "center",
    gap: 16,
    paddingVertical: 8,
  },
  tapRingOuter: {
    position: "absolute",
    width: CIRCLE + 52,
    height: CIRCLE + 52,
    borderRadius: (CIRCLE + 52) / 2,
    borderWidth: 1.5,
    borderColor: C.cyan,
    top: -(52 / 2) + 8,
  },
  tapRingMiddle: {
    position: "absolute",
    width: CIRCLE + 24,
    height: CIRCLE + 24,
    borderRadius: (CIRCLE + 24) / 2,
    borderWidth: 1,
    borderColor: "rgba(179,136,255,0.2)",
    top: -(24 / 2) + 8,
  },
  tapCircle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 16,
    padding: 3,
  },
  tapCircleInner: {
    width: CIRCLE - 6,
    height: CIRCLE - 6,
    borderRadius: (CIRCLE - 6) / 2,
    backgroundColor: "rgba(6,9,30,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  tapCount: { fontSize: 52, fontWeight: "900", color: C.white },
  tapLabel: {
    fontSize: 13,
    fontWeight: "900",
    color: C.textSub,
    marginTop: 2,
  },
  tapHint: { fontSize: 12, fontWeight: "700", color: C.textMuted },

  // ── Leaderboard ──
  leaderCard: {
    width: "100%",
    borderRadius: 28,
    padding: 18,
    marginTop: 8,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1.5,
    borderColor: C.lavBorder,
  },
  leaderCardWatermark: {
    position: "absolute",
    fontSize: 90,
    opacity: 0.05,
    right: 0,
    top: -10,
  },
  leaderTitle: {
    color: C.gold,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 12,
    textAlign: "center",
  },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
  },
  leaderRowMe: {
    borderRadius: 14,
    borderBottomWidth: 0,
    marginVertical: 2,
    borderWidth: 1,
    borderColor: C.cyanBorder,
  },
  leaderRankText: { fontSize: 20, width: 36, textAlign: "center" },
  leaderAvatarText: { fontSize: 26 },
  leaderName: {
    flex: 1,
    color: C.textSub,
    fontSize: 13,
    fontWeight: "800",
  },
  leaderScorePill: {
    backgroundColor: C.goldDim,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    minWidth: 44,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  leaderScore: { color: C.gold, fontSize: 14, fontWeight: "900" },

  backBtn: {
    marginTop: 20,
    backgroundColor: C.bgCard,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.bgCardBorder,
  },
  backBtnText: { color: C.white, fontSize: 15, fontWeight: "800" },
});
