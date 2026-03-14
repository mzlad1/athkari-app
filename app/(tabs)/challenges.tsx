import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Share,
  RefreshControl,
  TextInput,
  Modal,
  Dimensions,
  Animated,
} from "react-native";
import { useState, useCallback, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "expo-router";
import { COLORS } from "@/constants/theme";
import { T } from "@/constants/translations";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import {
  useChallenges,
  useLeaderboard,
  useChallengeTemplates,
} from "@/hooks/useChallenges";
import { useFriends } from "@/hooks/useFriends";
import { useKidStats } from "@/hooks/useKidStats";
import { challengesService } from "@/services/challenges";
import { friendsService } from "@/services/friends";
import { router as expoRouter } from "expo-router";
import { ChallengesSkeleton } from "@/components/ui/Skeleton";
import { LinearGradient } from "expo-linear-gradient";
import { useToast } from "@/hooks/useToast";
import { Toast } from "@/components/ui";
import { getLevelFromStars } from "@/constants/levels";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { soundService } from "@/services/sounds";

const { width } = Dimensions.get("window");

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
  textSub: "rgba(255,255,255,0.6)",
  inputBg: "rgba(255,255,255,0.07)",
  inputBorder: "rgba(255,255,255,0.12)",
};

const REACTIONS = [
  { id: "mashallah", icon: "🤩", ar: "ما شاء الله", en: "Masha'Allah" },
  { id: "keep", icon: "💪", ar: "استمر", en: "Keep going" },
  { id: "love", icon: "❤️", ar: "أحبك", en: "Love it" },
  { id: "dua", icon: "🤲", ar: "دعاء لك", en: "Dua for you" },
];

const SOCIAL_BADGES = [
  {
    id: 1,
    icon: "🤝",
    nameAr: "صديق جديد",
    nameEn: "New Friend",
    descAr: "أضف أول صديق",
    descEn: "Add first friend",
    req: 1,
  },
  {
    id: 2,
    icon: "👥",
    nameAr: "اجتماعي",
    nameEn: "Social",
    descAr: "أضف ٥ أصدقاء",
    descEn: "Add 5 friends",
    req: 5,
  },
  {
    id: 3,
    icon: "🎉",
    nameAr: "مشجع",
    nameEn: "Motivator",
    descAr: "أرسل ١٠ ردود",
    descEn: "Send 10 reactions",
    req: 10,
  },
];

export default function ChallengesScreen() {
  const [subTab, setSubTab] = useState("lead");
  const { activeKid } = useAuth();
  const { lang } = useLang();
  const isRTL = lang === "ar";
  const t = T[lang];
  const kidId = activeKid?.id || null;
  const flags = useFeatureFlags();

  const {
    challenges,
    loading: challengesLoading,
    refresh: refreshChallenges,
  } = useChallenges();
  const {
    leaderboard,
    loading: leaderLoading,
    refresh: refreshLeaderboard,
  } = useLeaderboard(kidId || undefined);
  const {
    friends,
    loading: friendsLoading,
    refresh: refreshFriends,
  } = useFriends(kidId || undefined);
  const { stats } = useKidStats(kidId || undefined);
  const { templates: challTemplates } = useChallengeTemplates();
  const [refreshing, setRefreshing] = useState(false);
  const [allowFriends, setAllowFriends] = useState(true);
  const [allowChat, setAllowChat] = useState(false);
  const [allowKidAcceptChallenge, setAllowKidAcceptChallenge] = useState(true);
  const [showReaction, setShowReaction] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast, showToast } = useToast();

  const [friendCodeInput, setFriendCodeInput] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);

  const [showChallModal, setShowChallModal] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [sendingChall, setSendingChall] = useState(false);

  const [detailChallenge, setDetailChallenge] = useState<any>(null);

  const [chatFriend, setChatFriend] = useState<string | null>(null);
  const [chatMsg, setChatMsg] = useState("");
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  const [pendingChallenges, setPendingChallenges] = useState<any[]>([]);
  const [sentChallenges, setSentChallenges] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!kidId) return;
      AsyncStorage.getItem(`allow_friends_${kidId}`).then((val) => {
        const allowed = val === null ? true : val === "true";
        setAllowFriends(allowed);
        if (!allowed && (subTab === "friends" || subTab === "invite"))
          setSubTab("lead");
      });
      AsyncStorage.getItem(`allow_chat_${kidId}`).then((val) => {
        setAllowChat(val === "true");
      });
      AsyncStorage.getItem(`allow_kid_accept_challenge_${kidId}`).then(
        (val) => {
          setAllowKidAcceptChallenge(val === null ? true : val === "true");
        },
      );
      loadRequests();
      loadPendingChallenges();
      refreshLeaderboard();
      refreshFriends();
      refreshChallenges();
      challengesService.checkAndCompleteExpired().catch(() => {});
    }, [kidId]),
  );

  const loadRequests = async () => {
    if (!kidId) return;
    try {
      const [inc, out] = await Promise.all([
        friendsService.getIncomingRequests(kidId),
        friendsService.getOutgoingRequests(kidId),
      ]);
      setIncomingRequests(inc);
      setOutgoingRequests(out);
    } catch {}
  };

  const loadPendingChallenges = async () => {
    if (!kidId) return;
    try {
      const data = await challengesService.getPendingInvites(kidId);
      setPendingChallenges(data);
    } catch {}
  };

  const activeChallenges =
    challenges?.filter((c: any) => c.status === "active") || [];
  const completedChallenges =
    challenges?.filter((c: any) => c.status === "completed") || [];
  const communityChallenges = activeChallenges.filter(
    (c: any) => c.type !== "1v1",
  );
  const completedCommunityChallenges = completedChallenges.filter(
    (c: any) => c.type !== "1v1",
  );
  const oneVOneChallenges = [
    ...activeChallenges.filter(
      (c: any) =>
        c.type === "1v1" &&
        c.challenge_participants?.some((p: any) => p.kid_id === kidId),
    ),
    ...completedChallenges.filter(
      (c: any) =>
        c.type === "1v1" &&
        c.challenge_participants?.some((p: any) => p.kid_id === kidId),
    ),
  ];

  const myScheduledChallenges = (challenges || []).filter(
    (c: any) =>
      c.status === "scheduled" &&
      c.type === "1v1" &&
      c.challenge_participants?.some(
        (p: any) => p.kid_id === kidId && p.contribution === 0,
      ),
  );

  const SUB_TABS = [
    ...(flags.leaderboard ? [{ key: "lead", label: t.lead, emoji: "🏆" }] : []),
    ...(flags.challenges
      ? [{ key: "weekly", label: t.weekly, emoji: "📅" }]
      : []),
    ...(allowFriends && flags.friends
      ? [
          { key: "friends", label: t.friendsTab, emoji: "👫" },
          { key: "invite", label: t.inviteTab, emoji: "✉️" },
        ]
      : []),
  ];

  const labelAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    labelAnim.setValue(0);
    Animated.spring(labelAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  }, [subTab]);

  // Auto-switch to first visible tab if current tab is hidden
  useEffect(() => {
    if (SUB_TABS.length > 0 && !SUB_TABS.some((t) => t.key === subTab)) {
      setSubTab(SUB_TABS[0].key);
    }
  }, [flags, allowFriends]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refreshFriends(),
      refreshChallenges(),
      refreshLeaderboard(),
      loadRequests(),
      loadPendingChallenges(),
    ]);
    setRefreshing(false);
  }, [refreshFriends, refreshChallenges, refreshLeaderboard, kidId]);

  const handleSendFriendRequest = async () => {
    if (!kidId || !friendCodeInput.trim()) return;
    if (friendCodeInput.trim() === activeKid?.friend_code) {
      showToast(
        isRTL ? "لا يمكنك إضافة نفسك" : "You can't add yourself",
        "error",
      );
      return;
    }
    setSendingRequest(true);
    try {
      await friendsService.sendRequest(kidId, friendCodeInput.trim());
      showToast(t.requestSent);
      setFriendCodeInput("");
      await loadRequests();
    } catch (e: any) {
      showToast(
        e.message || (isRTL ? "الكود غير صحيح" : "Invalid code"),
        "error",
      );
    } finally {
      setSendingRequest(false);
    }
  };

  const handleAcceptRequest = async (reqId: string) => {
    try {
      await friendsService.acceptRequest(reqId);
      showToast(t.friendAccepted);
      await Promise.all([
        loadRequests(),
        refreshFriends(),
        refreshLeaderboard(),
      ]);
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const handleDeclineRequest = async (reqId: string) => {
    try {
      await friendsService.rejectRequest(reqId);
      showToast(t.friendDeclined);
      await loadRequests();
    } catch {}
  };

  const handleSendReaction = async (
    friendKidId: string,
    reactionId: string,
  ) => {
    if (!kidId) return;
    try {
      await friendsService.sendReaction(kidId, friendKidId, reactionId);
      showToast(t.reactionSent);
    } catch (e: any) {
      showToast(e?.message || "Failed to send reaction", "error");
    }
    setShowReaction(null);
  };

  const oneVOneTemplates = (challTemplates || []).filter(
    (tmpl: any) => tmpl.type === "1v1",
  );

  const handleChallengeFriend = (friend: any) => {
    setShowChallModal(friend);
    setSelectedTemplate(
      oneVOneTemplates.length > 0 ? oneVOneTemplates[0] : null,
    );
  };

  const handleStartChallenge = async () => {
    if (!kidId || !showChallModal || !selectedTemplate) return;
    setSendingChall(true);
    try {
      await challengesService.create1v1FromTemplate(
        selectedTemplate.id,
        kidId,
        showChallModal.id,
      );
      showToast(t.challengeStarted);
      setShowChallModal(null);
      await refreshChallenges();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSendingChall(false);
    }
  };

  const handleAcceptChallenge = async (challengeId: number) => {
    try {
      await challengesService.acceptInvite(challengeId, kidId!);
      showToast(t.challengeAccepted);
      await Promise.all([refreshChallenges(), loadPendingChallenges()]);
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const handleRejectChallenge = async (challengeId: number) => {
    try {
      await challengesService.rejectInvite(challengeId, kidId!);
      showToast(t.challengeRejected);
      await Promise.all([refreshChallenges(), loadPendingChallenges()]);
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const handleSendChat = async (friendId: string) => {
    if (!kidId || !chatMsg.trim()) return;
    try {
      await friendsService.sendReaction(
        kidId,
        friendId,
        `chat:${chatMsg.trim()}`,
      );
      showToast(t.reactionSent);
      setChatMsg("");
      loadChatHistory(friendId);
    } catch (e: any) {
      showToast(e?.message || "Failed to send message", "error");
    }
  };

  const loadChatHistory = async (friendId: string) => {
    if (!kidId) return;
    setLoadingChat(true);
    try {
      const data = await friendsService.getChatHistory(kidId, friendId);
      setChatHistory(data);
      friendsService.markReactionsRead(kidId).catch(() => {});
    } catch {}
    setLoadingChat(false);
  };

  const toggleChatPanel = (friendId: string) => {
    if (showReaction === friendId) {
      setShowReaction(null);
      setChatHistory([]);
    } else {
      setShowReaction(friendId);
      setChatFriend(friendId);
      loadChatHistory(friendId);
    }
  };

  const handleCopyCode = async () => {
    const code = activeKid?.friend_code || "ATHK0000";
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async (medium?: string) => {
    const code = activeKid?.friend_code || "ATHK0000";
    const msg = isRTL
      ? `ادخل كودي في تطبيق أذكاري: ${code} 🌟`
      : `Use my code in Athkari: ${code} 🌟`;
    if (medium) {
      showToast(`${medium}`);
    } else {
      try {
        await Share.share({ message: msg });
      } catch {}
    }
  };

  const handleJoinChallenge = async (challengeId: string) => {
    if (!kidId) return;
    try {
      await challengesService.joinChallenge(Number(challengeId), kidId);
      showToast(isRTL ? "انضممت للتحدي!" : "Joined the challenge!");
      await refreshChallenges();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  if (challengesLoading && friendsLoading) {
    return (
      <ScrollView style={styles.container}>
        <ChallengesSkeleton />
      </ScrollView>
    );
  }

  const leaderboardData =
    leaderboard.length > 0
      ? [
          ...leaderboard.filter((f: any) => f.id === kidId),
          ...leaderboard.filter((f: any) => f.id !== kidId),
        ]
      : [];

  return (
    <View style={{ flex: 1 }}>
      <Toast toast={toast} />
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
            CHALLENGE FRIEND MODAL
        ══════════════════════════════════════════ */}
        <Modal visible={!!showChallModal} transparent animationType="slide">
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowChallModal(null)}
          >
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <View style={styles.sheetHandle} />
              <LinearGradient
                colors={["#0D0033", "#1A0055"]}
                style={styles.modalHeaderGrad}
              >
                <Text style={styles.modalHeaderEmoji}>⚔️</Text>
                <Text style={styles.modalTitle}>{t.challFriend}</Text>
                {showChallModal && (
                  <View style={styles.modalFriendRow}>
                    <Text style={{ fontSize: 32 }}>
                      {showChallModal.avatar ||
                        showChallModal.avatar_emoji ||
                        "🌟"}
                    </Text>
                    <Text style={styles.modalFriendName}>
                      {showChallModal.display_name || showChallModal.name}
                    </Text>
                  </View>
                )}
              </LinearGradient>

              <Text style={styles.modalLabel}>
                {isRTL ? "اختر التحدي" : "Choose Challenge"}
              </Text>

              {oneVOneTemplates.length === 0 ? (
                <Text style={styles.emptyText}>
                  {isRTL ? "لا تحديات متاحة" : "No challenges available yet"}
                </Text>
              ) : (
                <ScrollView
                  style={{ maxHeight: 240, marginBottom: 16 }}
                  nestedScrollEnabled
                >
                  {oneVOneTemplates.map((tmpl: any) => {
                    const sel = selectedTemplate?.id === tmpl.id;
                    return (
                      <Pressable
                        key={tmpl.id}
                        style={[
                          styles.templateBtn,
                          sel && styles.templateBtnActive,
                        ]}
                        onPress={() => {
                          soundService.play("tab_press");
                          setSelectedTemplate(tmpl);
                        }}
                      >
                        <Text
                          style={[
                            styles.templateName,
                            sel && { color: C.lavender },
                          ]}
                        >
                          {isRTL ? tmpl.name_ar : tmpl.name_en}
                        </Text>
                        <Text style={styles.templateDhikr}>
                          📿 {tmpl.dhikr_text_ar}
                        </Text>
                        <Text style={styles.templateMeta}>
                          🎯 {tmpl.goal} • {tmpl.duration_days}{" "}
                          {isRTL ? "أيام" : "days"} • +{tmpl.reward_stars} ⭐
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              <Pressable
                style={styles.modalActionWrap}
                onPress={() => {
                  soundService.play("tab_press");
                  handleStartChallenge();
                }}
                disabled={sendingChall}
              >
                <LinearGradient
                  colors={[C.lavender, C.cyan]}
                  style={[styles.fullBtn, sendingChall && { opacity: 0.5 }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.fullBtnText}>
                    {sendingChall ? "⏳" : `🚀 ${t.startChallenge}`}
                  </Text>
                </LinearGradient>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* ══════════════════════════════════════════
            CHALLENGE DETAIL MODAL
        ══════════════════════════════════════════ */}
        <Modal visible={!!detailChallenge} transparent animationType="slide">
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setDetailChallenge(null)}
          >
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <View style={styles.sheetHandle} />
              {detailChallenge &&
                (() => {
                  const c = detailChallenge;
                  const daysLeft = Math.max(
                    0,
                    Math.ceil(
                      (new Date(c.end_date).getTime() - Date.now()) / 86400000,
                    ),
                  );
                  const isCompleted =
                    c.status === "completed" || daysLeft === 0;
                  const myPart = c.challenge_participants?.find(
                    (p: any) => p.kid_id === kidId,
                  );
                  const opPart = c.challenge_participants?.find(
                    (p: any) => p.kid_id !== kidId,
                  );
                  const myScore = myPart?.contribution || 0;
                  const opScore = opPart?.contribution || 0;
                  const opKid = opPart?.kids;
                  const isWinner = isCompleted && myScore > opScore;
                  const isLoser = isCompleted && myScore < opScore;
                  const isTie = isCompleted && myScore === opScore;

                  return (
                    <View>
                      <LinearGradient
                        colors={
                          isWinner
                            ? ["#003D28", "#005A3C"]
                            : isLoser
                              ? ["#3D0010", "#5A0018"]
                              : ["#1C1000", "#2E1A00"]
                        }
                        style={styles.detailHeader}
                      >
                        <Text style={styles.detailHeaderEmoji}>
                          {isCompleted
                            ? isWinner
                              ? "🏆"
                              : isLoser
                                ? "😢"
                                : "🤝"
                            : "⚔️"}
                        </Text>
                        <Text style={styles.detailHeaderTitle}>
                          {isRTL ? c.name_ar : c.name_en}
                        </Text>
                        {isCompleted && (
                          <View style={styles.resultBadge}>
                            <Text style={styles.resultBadgeText}>
                              {isWinner
                                ? t.youWon
                                : isLoser
                                  ? t.youLost
                                  : t.itsTie}
                            </Text>
                          </View>
                        )}
                      </LinearGradient>

                      <View style={styles.vsRow}>
                        <View style={styles.vsPlayer}>
                          <Text style={styles.vsAvatar}>
                            {activeKid?.avatar || "🌟"}
                          </Text>
                          <Text style={styles.vsName}>
                            {activeKid?.display_name || activeKid?.name || t.me}
                          </Text>
                          <Text style={styles.vsScore}>{myScore}</Text>
                          <Text style={styles.vsLabel}>
                            {isRTL ? "ذكر" : "adhkar"}
                          </Text>
                        </View>
                        <View style={styles.vsCenter}>
                          <Text style={styles.vsText}>VS</Text>
                        </View>
                        <View style={styles.vsPlayer}>
                          <Text style={styles.vsAvatar}>
                            {opKid?.avatar || "🌟"}
                          </Text>
                          <Text style={styles.vsName}>
                            {opKid?.name || "?"}
                          </Text>
                          <Text style={[styles.vsScore, { color: C.gold }]}>
                            {opScore}
                          </Text>
                          <Text style={styles.vsLabel}>
                            {isRTL ? "ذكر" : "adhkar"}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.vsBar}>
                        <View
                          style={[styles.vsBarMe, { flex: myScore || 0.5 }]}
                        />
                        <View
                          style={[styles.vsBarOp, { flex: opScore || 0.5 }]}
                        />
                      </View>

                      <View style={styles.detailMeta}>
                        <Text style={styles.detailMetaText}>
                          📅 {c.start_date} → {c.end_date}
                        </Text>
                        <Text style={styles.detailMetaText}>
                          {isCompleted
                            ? isRTL
                              ? "انتهى"
                              : "Ended"
                            : `${daysLeft} ${t.daysLeft}`}
                        </Text>
                      </View>

                      {isCompleted && isWinner && (
                        <LinearGradient
                          colors={["#003D28", "#005A3C"]}
                          style={styles.rewardBox}
                        >
                          <Text style={styles.rewardBoxText}>
                            🎉 +{c.reward_stars || 50} ⭐{" "}
                            {isRTL ? "مكافأة!" : "Reward!"}
                          </Text>
                        </LinearGradient>
                      )}

                      <Pressable
                        style={styles.closeBtn}
                        onPress={() => setDetailChallenge(null)}
                      >
                        <Text style={styles.closeBtnText}>
                          {isRTL ? "إغلاق" : "Close"}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })()}
            </Pressable>
          </Pressable>
        </Modal>

        {/* ══════════════════════════════════════════
            HERO HEADER
        ══════════════════════════════════════════ */}
        <LinearGradient
          colors={["#0D1040", "#060918"]}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.blobCyan} />
          <View style={styles.blobCoral} />
          {[
            { top: 22, left: 40, s: 3 },
            { top: 50, left: 160, s: 2 },
            { top: 18, right: 70, s: 2.5 },
            { top: 68, right: 130, s: 2 },
            { top: 38, left: 230, s: 2 },
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

          <View style={styles.headerIconWrap}>
            <LinearGradient
              colors={["#1C0A00", "#2E1200"]}
              style={styles.headerIconCircle}
            >
              <Text style={{ fontSize: 30 }}>⚔️</Text>
            </LinearGradient>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.headerLabel}>✨ {t.challTitle}</Text>
            <Text style={styles.headerTitle}>
              {isRTL ? "التحديات 🏆" : "Challenges 🏆"}
            </Text>
            <Text style={styles.headerSub}>
              {isRTL
                ? "تنافس مع أصدقائك وافز بالنجوم!"
                : "Compete with friends & win stars!"}
            </Text>
          </View>
        </LinearGradient>

        {/* ══════════════════════════════════════════
            STATS ROW
        ══════════════════════════════════════════ */}
        <View style={styles.statsRow}>
          {[
            {
              colors: ["#1C1000", "#2E1A00"] as [string, string],
              border: C.goldBorder,
              glow: C.gold,
              num: stats?.stars || 0,
              label: isRTL ? "النجوم" : "Stars",
              emoji: "⭐",
              numColor: C.gold,
            },
            {
              colors: ["#1A0A3A", "#2D1050"] as [string, string],
              border: C.lavBorder,
              glow: C.lavender,
              num: activeChallenges.length,
              label: isRTL ? "التحديات" : "Active",
              emoji: "⚔️",
              numColor: C.lavender,
            },
            {
              colors: ["#003020", "#004830"] as [string, string],
              border: C.mintBorder,
              glow: C.mint,
              num: friends.length,
              label: isRTL ? "الأصدقاء" : "Friends",
              emoji: "👫",
              numColor: C.mint,
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
              <Text style={[styles.statNum, { color: s.numColor }]}>
                {s.num}
              </Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </LinearGradient>
          ))}
        </View>

        {/* ── Friends Disabled Banner ── */}
        {!allowFriends && (
          <View style={styles.disabledBanner}>
            <Text style={{ fontSize: 22 }}>🔒</Text>
            <Text style={styles.disabledText}>{t.friendsDisabled}</Text>
          </View>
        )}

        {/* ══════════════════════════════════════════
            SUB-TABS
        ══════════════════════════════════════════ */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ paddingVertical: 10, direction: "ltr" }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {SUB_TABS.map((tb) => {
            const active = subTab === tb.key;
            return (
              <Pressable
                key={tb.key}
                onPress={() => {
                  soundService.play("tab_press");
                  setSubTab(tb.key);
                }}
                style={{ borderRadius: 20, overflow: "hidden" }}
              >
                {active ? (
                  <LinearGradient
                    colors={[C.lavender, C.cyan]}
                    style={styles.tabActive}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.tabEmoji}>{tb.emoji}</Text>
                    <Text style={styles.tabTextActive}>{tb.label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.tabInactive}>
                    <Text style={[styles.tabEmoji, { opacity: 0.45 }]}>
                      {tb.emoji}
                    </Text>
                    <Text style={styles.tabText}>{tb.label}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            LEADERBOARD TAB
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {subTab === "lead" && (
          <View style={styles.section}>
            {/* Podium */}
            {leaderboardData.length >= 3 && (
              <LinearGradient
                colors={["rgba(255,214,10,0.06)", "rgba(179,136,255,0.04)"]}
                style={styles.podiumWrap}
              >
                <View style={styles.podium}>
                  {/* 2nd */}
                  <View style={[styles.podiumItem, { marginTop: 28 }]}>
                    <Text style={styles.podiumAvatar}>
                      {leaderboardData[1]?.avatar || "🌟"}
                    </Text>
                    <LinearGradient
                      colors={["#2A2A2A", "#3A3A3A"]}
                      style={[styles.podiumBlock, { height: 64 }]}
                    >
                      <Text style={styles.podiumRank}>🥈</Text>
                    </LinearGradient>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {leaderboardData[1]?.name}
                    </Text>
                    <Text style={styles.podiumStars}>
                      ⭐ {leaderboardData[1]?.stars || 0}
                    </Text>
                  </View>
                  {/* 1st */}
                  <View style={styles.podiumItem}>
                    <View style={styles.podiumCrown}>
                      <Text style={{ fontSize: 22 }}>👑</Text>
                    </View>
                    <Text style={styles.podiumAvatar}>
                      {leaderboardData[0]?.avatar || "🌟"}
                    </Text>
                    <LinearGradient
                      colors={[C.gold, "#FF9100"]}
                      style={[styles.podiumBlock, { height: 84 }]}
                    >
                      <Text style={styles.podiumRank}>🥇</Text>
                    </LinearGradient>
                    <Text
                      style={[styles.podiumName, { color: C.gold }]}
                      numberOfLines={1}
                    >
                      {leaderboardData[0]?.name}
                    </Text>
                    <Text style={styles.podiumStars}>
                      ⭐ {leaderboardData[0]?.stars || 0}
                    </Text>
                  </View>
                  {/* 3rd */}
                  <View style={[styles.podiumItem, { marginTop: 44 }]}>
                    <Text style={styles.podiumAvatar}>
                      {leaderboardData[2]?.avatar || "🌟"}
                    </Text>
                    <LinearGradient
                      colors={["#3D1A00", "#5A2800"]}
                      style={[styles.podiumBlock, { height: 46 }]}
                    >
                      <Text style={styles.podiumRank}>🥉</Text>
                    </LinearGradient>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {leaderboardData[2]?.name}
                    </Text>
                    <Text style={styles.podiumStars}>
                      ⭐ {leaderboardData[2]?.stars || 0}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            )}

            {/* Full list */}
            {leaderboardData.map((f: any, index: number) => {
              const isMe = f.id === kidId;
              const rank: number = f.rank ?? index + 1;
              const rankEmoji =
                rank === 1
                  ? "🥇"
                  : rank === 2
                    ? "🥈"
                    : rank === 3
                      ? "🥉"
                      : `#${rank}`;
              const lv = getLevelFromStars(f.stars || 0);

              return (
                <View
                  key={f.id}
                  style={[
                    styles.leaderCard,
                    rank === 1 && styles.leaderCardGold,
                    isMe && styles.leaderCardMe,
                  ]}
                >
                  <Text style={styles.leaderRankEmoji}>{rankEmoji}</Text>
                  <View>
                    <View style={styles.leaderAvatarWrap}>
                      <Text style={{ fontSize: 26 }}>
                        {f.avatar || f.avatar_emoji || "🌟"}
                      </Text>
                    </View>
                    <LinearGradient
                      colors={lv.gradient}
                      style={styles.leaderLvlBadge}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.leaderLvlText}>
                        {lv.emoji}
                        {lv.level}
                      </Text>
                    </LinearGradient>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.leaderName, isMe && { color: C.cyan }]}
                    >
                      {f.display_name || f.name}
                      {isMe ? ` (${t.me})` : ""}
                    </Text>
                    <Text style={styles.leaderStats}>
                      {f.streak || 0} {t.days} • {f.today_count || 0} {t.today}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.leaderStarBadge,
                      isMe && {
                        backgroundColor: C.cyanDim,
                        borderColor: C.cyanBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.leaderStarText, isMe && { color: C.cyan }]}
                    >
                      ⭐ {f.stars || 0}
                    </Text>
                  </View>
                </View>
              );
            })}

            {leaderboardData.length <= 1 && !leaderLoading && (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 48, marginBottom: 8 }}>🏆</Text>
                <Text style={styles.emptyText}>
                  {isRTL
                    ? "أضف أصدقاء لتتنافس معهم!"
                    : "Add friends to compete!"}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            WEEKLY / CHALLENGES TAB
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {subTab === "weekly" && (
          <View style={styles.section}>
            {/* Community challenges */}
            {communityChallenges.map((c: any) => {
              const hasJoined = c.challenge_participants?.some(
                (p: any) => p.kid_id === kidId,
              );
              const myContribution =
                c.challenge_participants?.find((p: any) => p.kid_id === kidId)
                  ?.contribution || 0;
              const daysLeft = Math.max(
                0,
                Math.ceil(
                  (new Date(c.end_date).getTime() - Date.now()) / 86400000,
                ),
              );
              const pct = Math.min(
                ((c.progress || 0) / (c.goal || 1)) * 100,
                100,
              );

              return (
                <LinearGradient
                  key={c.id}
                  colors={["#0D0033", "#1A0055"]}
                  style={styles.communityCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.communityWatermark}>🌍</Text>
                  <Text style={styles.communityLabel}>
                    🌍 {isRTL ? "تحدي المجتمع" : "Community Challenge"}
                  </Text>
                  <Text style={styles.communityTitle}>
                    {isRTL ? c.name_ar : c.name_en}
                  </Text>
                  {!!(isRTL ? c.description_ar : c.description_en) && (
                    <Text style={styles.communityDesc}>
                      {isRTL ? c.description_ar : c.description_en}
                    </Text>
                  )}
                  <View style={styles.communityBarBg}>
                    <LinearGradient
                      colors={[C.lavender, C.cyan]}
                      style={[
                        styles.communityBarFill,
                        { width: `${pct}%` as any },
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    />
                  </View>
                  <View style={styles.communityMeta}>
                    <Text style={styles.communityMetaText}>
                      {c.progress || 0}/{c.goal || 1000}
                    </Text>
                    <Text style={styles.communityMetaText}>
                      👥 {c.challenge_participants?.length || 0} • ⏰ {daysLeft}{" "}
                      {t.days}
                    </Text>
                  </View>
                  <View style={styles.communityRewardRow}>
                    <View style={styles.communityRewardBadge}>
                      <Text style={styles.communityRewardText}>
                        🥇 {c.reward_stars || 50} ⭐
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.communityRewardBadge,
                        { backgroundColor: C.lavDim, borderColor: C.lavBorder },
                      ]}
                    >
                      <Text
                        style={[
                          styles.communityRewardText,
                          { color: C.lavender },
                        ]}
                      >
                        🥈{" "}
                        {c.reward_stars_2nd ||
                          Math.round((c.reward_stars || 50) * 0.7)}{" "}
                        ⭐
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.communityRewardBadge,
                        {
                          backgroundColor: C.cyanDim,
                          borderColor: C.cyanBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.communityRewardText, { color: C.cyan }]}
                      >
                        🥉{" "}
                        {c.reward_stars_3rd ||
                          Math.round((c.reward_stars || 50) * 0.5)}{" "}
                        ⭐
                      </Text>
                    </View>
                  </View>
                  {hasJoined ? (
                    <View style={{ gap: 8, marginTop: 10 }}>
                      <View style={styles.contributionRow}>
                        <Text style={styles.contributionText}>
                          ✅{" "}
                          {isRTL
                            ? `مساهمتك: ${myContribution}`
                            : `Your contribution: ${myContribution}`}
                        </Text>
                        <Text style={styles.communityMetaText}>
                          ⏰ {daysLeft} {t.days}
                        </Text>
                      </View>
                      <Pressable
                        style={styles.startDhikrBtn}
                        onPress={() => {
                          soundService.play("tab_press");
                          expoRouter.push(`/challenge/${c.id}`);
                        }}
                      >
                        <LinearGradient
                          colors={[C.gold, "#FF9100"]}
                          style={styles.startDhikrInner}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Text style={styles.startDhikrText}>
                            📿 {isRTL ? "ابدأ التسبيح" : "Start Dhikr"}
                          </Text>
                        </LinearGradient>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.joinBtnWrap}
                      onPress={() => {
                        soundService.play("tab_press");
                        handleJoinChallenge(c.id);
                      }}
                    >
                      <View style={styles.joinBtn}>
                        <Text style={styles.joinBtnText}>
                          🚀 {isRTL ? "انضم للتحدي!" : "Join Challenge!"}
                        </Text>
                      </View>
                    </Pressable>
                  )}
                </LinearGradient>
              );
            })}

            {communityChallenges.length === 0 &&
              completedCommunityChallenges.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 48, marginBottom: 8 }}>🏆</Text>
                  <Text style={styles.emptyText}>
                    {isRTL
                      ? "لا توجد تحديات مجتمعية حالياً"
                      : "No community challenges right now"}
                  </Text>
                  <Text style={styles.emptySubText}>
                    {isRTL
                      ? "ترقبوا التحديات القادمة!"
                      : "Stay tuned for upcoming challenges!"}
                  </Text>
                </View>
              )}

            {/* Pending invites */}
            {flags["1v1"] && pendingChallenges.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>{t.pendingChallenges}</Text>
                {pendingChallenges.map((c: any) => {
                  const challenger = c.challenge_participants?.find(
                    (p: any) => p.kid_id !== kidId && p.contribution === 0,
                  );
                  const challengerKid = challenger?.kids;
                  return (
                    <View key={c.id} style={styles.pendingCard}>
                      <View style={styles.pendingHeader}>
                        <View style={styles.pendingAvatarWrap}>
                          <Text style={{ fontSize: 28 }}>
                            {challengerKid?.avatar || "🌟"}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pendingTitle}>
                            {isRTL ? c.name_ar : c.name_en}
                          </Text>
                          <Text style={styles.pendingFrom}>
                            {challengerKid?.name || "?"} {t.challengeInviteDesc}
                          </Text>
                        </View>
                        <View style={styles.pendingNewBadge}>
                          <Text style={styles.pendingNewText}>
                            {isRTL ? "جديد!" : "New!"}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.pendingMeta}>
                        🎯 {c.goal} • {c.duration_days} {t.daysLeft} • +
                        {c.reward_stars || 50} ⭐
                      </Text>
                      {allowKidAcceptChallenge ? (
                        <View style={styles.pendingBtns}>
                          <Pressable
                            style={[styles.acceptBtn, { flex: 1 }]}
                            onPress={() => {
                              soundService.play("tab_press");
                              handleAcceptChallenge(c.id);
                            }}
                          >
                            <Text style={styles.acceptBtnText}>
                              ✅ {t.acceptChallenge}
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[styles.declineBtn, { flex: 1 }]}
                            onPress={() => {
                              soundService.play("tab_press");
                              handleRejectChallenge(c.id);
                            }}
                          >
                            <Text style={styles.declineBtnText}>
                              ❌ {t.rejectChallenge}
                            </Text>
                          </Pressable>
                        </View>
                      ) : (
                        <Text style={styles.parentOnlyText}>
                          ⏳{" "}
                          {isRTL
                            ? "الموافقة من قبل الوالدين فقط"
                            : "Challenge acceptance by parent only"}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {/* Challenge a friend */}
            {flags["1v1"] && allowFriends && friends.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>{t.challFriend}</Text>
                <View style={styles.friendChipsCard}>
                  <Text style={styles.pickLabel}>{t.pickFriend}</Text>
                  <View style={styles.friendChips}>
                    {friends.slice(0, 6).map((f: any) => (
                      <Pressable
                        key={f.id}
                        style={styles.friendChip}
                        onPress={() => {
                          soundService.play("tab_press");
                          handleChallengeFriend(f);
                        }}
                      >
                        <View style={styles.friendChipAvatar}>
                          <Text style={{ fontSize: 24 }}>
                            {f.avatar || f.avatar_emoji || "🌟"}
                          </Text>
                        </View>
                        <Text style={styles.friendChipName} numberOfLines={1}>
                          {f.display_name || f.name}
                        </Text>
                        <Text style={{ fontSize: 12 }}>⚔️</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            )}

            {/* Waiting for acceptance */}
            {flags["1v1"] && myScheduledChallenges.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: C.textMuted }]}>
                  {t.waitingAccept}
                </Text>
                {myScheduledChallenges.map((c: any) => (
                  <View key={c.id} style={styles.waitingCard}>
                    <Text style={styles.waitingText}>
                      {isRTL ? c.name_ar : c.name_en}
                    </Text>
                    <Text style={styles.waitingSubText}>{t.waitingAccept}</Text>
                  </View>
                ))}
              </>
            )}

            {/* 1v1 Challenges */}
            {flags["1v1"] && oneVOneChallenges.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>{t.yourChallenges}</Text>
                {oneVOneChallenges.map((c: any) => {
                  const daysLeft = Math.max(
                    0,
                    Math.ceil(
                      (new Date(c.end_date).getTime() - Date.now()) / 86400000,
                    ),
                  );
                  const isCompleted =
                    c.status === "completed" || daysLeft === 0;
                  const myPart = c.challenge_participants?.find(
                    (p: any) => p.kid_id === kidId,
                  );
                  const opPart = c.challenge_participants?.find(
                    (p: any) => p.kid_id !== kidId,
                  );
                  const myScore = myPart?.contribution || 0;
                  const opScore = opPart?.contribution || 0;
                  const opKid = opPart?.kids;
                  const isWinner = isCompleted && myScore > opScore;
                  const isLoser = isCompleted && myScore < opScore;

                  return (
                    <Pressable
                      key={c.id}
                      style={[
                        styles.oneVOneCard,
                        isCompleted && isWinner && styles.oneVOneCardWin,
                        isCompleted && isLoser && styles.oneVOneCardLose,
                      ]}
                      onPress={() => {
                        soundService.play("tab_press");
                        isCompleted
                          ? setDetailChallenge(c)
                          : expoRouter.push(`/challenge/${c.id}`);
                      }}
                    >
                      <View style={styles.oneVOneHeader}>
                        <Text style={styles.oneVOneTitle}>
                          {isCompleted
                            ? isWinner
                              ? "🏆 "
                              : isLoser
                                ? "😔 "
                                : "🤝 "
                            : "⚔️ "}
                          {isRTL ? c.name_ar : c.name_en}
                        </Text>
                        {isCompleted && (
                          <View
                            style={[
                              styles.resultPill,
                              isWinner && styles.resultPillWin,
                              isLoser && styles.resultPillLose,
                              !isWinner && !isLoser && styles.resultPillTie,
                            ]}
                          >
                            <Text
                              style={[
                                styles.resultPillText,
                                isWinner && { color: C.mint },
                                isLoser && { color: C.coral },
                                !isWinner && !isLoser && { color: C.gold },
                              ]}
                            >
                              {isWinner
                                ? t.youWon
                                : isLoser
                                  ? t.youLost
                                  : t.itsTie}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.oneVOneVs}>
                        <View style={styles.oneVOnePlayer}>
                          <Text style={{ fontSize: 22 }}>
                            {activeKid?.avatar || "🌟"}
                          </Text>
                          <Text style={styles.oneVOneScore}>{myScore}</Text>
                          <Text style={styles.oneVOnePlayerName}>{t.me}</Text>
                        </View>
                        <View style={styles.oneVOneBarWrap}>
                          <View style={styles.oneVOneBar}>
                            <View
                              style={[
                                styles.oneVOneBarMe,
                                { flex: myScore || 0.5 },
                              ]}
                            />
                            <View
                              style={[
                                styles.oneVOneBarOp,
                                { flex: opScore || 0.5 },
                              ]}
                            />
                          </View>
                          <Text style={styles.oneVOneTimeText}>
                            {isCompleted
                              ? isRTL
                                ? "انتهى"
                                : "Ended"
                              : `${daysLeft} ${t.daysLeft}`}
                          </Text>
                        </View>
                        <View style={styles.oneVOnePlayer}>
                          <Text style={{ fontSize: 22 }}>
                            {opKid?.avatar || "🌟"}
                          </Text>
                          <Text
                            style={[styles.oneVOneScore, { color: C.gold }]}
                          >
                            {opScore}
                          </Text>
                          <Text
                            style={styles.oneVOnePlayerName}
                            numberOfLines={1}
                          >
                            {opKid?.name || "?"}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </>
            )}

            {friends.length === 0 &&
              activeChallenges.length === 0 &&
              pendingChallenges.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 48, marginBottom: 8 }}>⚔️</Text>
                  <Text style={styles.emptyText}>
                    {isRTL
                      ? "أضف أصدقاء لبدء التحديات"
                      : "Add friends to start challenges"}
                  </Text>
                </View>
              )}

            {/* Completed community */}
            {completedCommunityChallenges.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>
                  ✅ {isRTL ? "تحديات منتهية" : "Completed Challenges"}
                </Text>
                {completedCommunityChallenges.map((c: any) => {
                  const myPart = c.challenge_participants?.find(
                    (p: any) => p.kid_id === kidId,
                  );
                  const wasParticipant = !!myPart;
                  const sorted = [...(c.challenge_participants || [])].sort(
                    (a: any, b: any) =>
                      (b.contribution || 0) - (a.contribution || 0),
                  );
                  const top3 = sorted.slice(0, 3);
                  const myRank = wasParticipant
                    ? sorted.findIndex((p: any) => p.kid_id === kidId) + 1
                    : 0;
                  const totalParticipants =
                    c.challenge_participants?.length || 0;

                  return (
                    <LinearGradient
                      key={c.id}
                      colors={["#0A1A2E", "#0D2440"]}
                      style={styles.endedCard}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {/* Header */}
                      <View style={styles.endedHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.endedTitle}>
                            🏆 {isRTL ? c.name_ar : c.name_en}
                          </Text>
                          <Text style={styles.endedSub}>
                            {c.progress || 0}/{c.goal || 0} • 👥{" "}
                            {totalParticipants} {t.participant}
                          </Text>
                        </View>
                        <View style={styles.endedBadge}>
                          <Text style={styles.endedBadgeText}>
                            {isRTL ? "انتهى" : "Ended"}
                          </Text>
                        </View>
                      </View>

                      {/* Progress bar full */}
                      <View style={styles.endedBarBg}>
                        <LinearGradient
                          colors={[C.mint, C.cyan]}
                          style={styles.endedBarFill}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        />
                      </View>

                      {/* Top 3 Podium */}
                      {top3.length > 0 && (
                        <View style={styles.endedPodium}>
                          <Text style={styles.endedPodiumTitle}>
                            {isRTL ? "🏆 الأوائل" : "🏆 Top Winners"}
                          </Text>
                          <View style={styles.endedPodiumRow}>
                            {top3.map((p: any, i: number) => {
                              const isMe = p.kid_id === kidId;
                              const medal =
                                i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
                              return (
                                <View
                                  key={p.kid_id}
                                  style={[
                                    styles.endedWinner,
                                    isMe && styles.endedWinnerMe,
                                  ]}
                                >
                                  <Text style={{ fontSize: 18 }}>{medal}</Text>
                                  <Text style={{ fontSize: 24 }}>
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
                        </View>
                      )}

                      {/* My result */}
                      {wasParticipant && (
                        <View style={styles.endedMyResult}>
                          <Text style={styles.endedMyRank}>
                            {myRank === 1
                              ? "🥇"
                              : myRank === 2
                                ? "🥈"
                                : myRank === 3
                                  ? "🥉"
                                  : "🏅"}{" "}
                            {isRTL
                              ? `مركزك #${myRank} من ${totalParticipants}`
                              : `Your rank #${myRank} of ${totalParticipants}`}
                          </Text>
                          <View style={styles.endedMyStats}>
                            <View style={styles.endedStatPill}>
                              <Text style={styles.endedStatText}>
                                📿{" "}
                                {isRTL
                                  ? `${myPart?.contribution || 0} ذكر`
                                  : `${myPart?.contribution || 0} dhikr`}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.endedStatPill,
                                {
                                  backgroundColor: C.goldDim,
                                  borderColor: C.goldBorder,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.endedStatText,
                                  { color: C.gold },
                                ]}
                              >
                                +{c.reward_stars || 50} ⭐
                              </Text>
                            </View>
                          </View>
                        </View>
                      )}
                    </LinearGradient>
                  );
                })}
              </>
            )}
          </View>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            FRIENDS TAB
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {subTab === "friends" && (
          <View style={styles.section}>
            {/* Incoming requests */}
            {incomingRequests.length > 0 && (
              <View style={styles.requestsCard}>
                <View style={styles.requestsCardHeader}>
                  <Text style={styles.requestsCardTitle}>
                    🔔 {t.incomingRequests} ({incomingRequests.length})
                  </Text>
                </View>
                <Text style={styles.requestsNote}>
                  {isRTL
                    ? "الموافقة على طلبات الصداقة تتم من قبل الوالدين فقط"
                    : "Friend requests are accepted by parents only"}
                </Text>
                {incomingRequests.map((req: any) => (
                  <View key={req.id} style={styles.requestRow}>
                    <Text style={{ fontSize: 26 }}>
                      {req.from_kid?.avatar || "🌟"}
                    </Text>
                    <Text style={styles.requestName}>
                      {req.from_kid?.name || "?"}
                    </Text>
                    <Text style={styles.waitingLabel}>
                      ⏳{" "}
                      {isRTL ? "بانتظار موافقة الوالد" : "Waiting for parent"}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Outgoing requests */}
            {outgoingRequests.length > 0 && (
              <View style={styles.requestsCard}>
                <Text style={styles.requestsCardTitle}>
                  📤 {t.outgoingRequests} ({outgoingRequests.length})
                </Text>
                {outgoingRequests.map((req: any) => (
                  <View key={req.id} style={styles.requestRow}>
                    <Text style={{ fontSize: 26 }}>
                      {req.to_kid?.avatar || "🌟"}
                    </Text>
                    <Text style={styles.requestName}>
                      {req.to_kid?.name || "?"}
                    </Text>
                    <Text style={styles.waitingLabel}>
                      ⏳ {t.waitingApproval}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.friendsCountLabel}>
              👫 {t.friendsCount} ({friends.length}/30)
            </Text>

            {friends.map((f: any) => {
              const fLvl = getLevelFromStars(f.stars || 0);
              return (
                <View key={f.id} style={styles.friendCard}>
                  <View style={styles.friendCardTop}>
                    <View>
                      <View style={styles.friendAvatarWrap}>
                        <Text style={{ fontSize: 28 }}>
                          {f.avatar || f.avatar_emoji || "🌟"}
                        </Text>
                      </View>
                      <LinearGradient
                        colors={fLvl.gradient}
                        style={styles.friendLvlBadge}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Text style={styles.friendLvlText}>
                          {fLvl.emoji}
                          {fLvl.level}
                        </Text>
                      </LinearGradient>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.friendName}>
                        {f.display_name || f.name}
                      </Text>
                      <Text style={styles.friendStats}>
                        🔥 {f.streak || 0} • ⭐ {f.stars || 0} •{" "}
                        {f.today_count || 0} {t.today}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <Pressable
                        style={styles.chatToggleBtn}
                        onPress={() => {
                          soundService.play("tab_press");
                          toggleChatPanel(f.kid_id || f.id);
                        }}
                      >
                        <Text style={{ fontSize: 16 }}>💬</Text>
                      </Pressable>
                      <Pressable
                        style={styles.challFriendBtn}
                        onPress={() => {
                          soundService.play("tab_press");
                          handleChallengeFriend(f);
                        }}
                      >
                        <Text style={{ fontSize: 16 }}>⚔️</Text>
                      </Pressable>
                    </View>
                  </View>

                  {showReaction === (f.kid_id || f.id) && (
                    <View style={styles.reactionPanel}>
                      <View style={styles.reactionGrid}>
                        {REACTIONS.map((r) => (
                          <Pressable
                            key={r.id}
                            style={styles.reactionItem}
                            onPress={() => {
                              soundService.play("tab_press");
                              handleSendReaction(f.kid_id || f.id, r.id);
                            }}
                          >
                            <Text style={{ fontSize: 22 }}>{r.icon}</Text>
                            <Text style={styles.reactionLabel}>
                              {isRTL ? r.ar : r.en}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      {chatHistory.length > 0 && (
                        <View style={styles.chatBox}>
                          <Text style={styles.chatBoxTitle}>
                            {t.messageHistory}
                          </Text>
                          <ScrollView
                            style={{ maxHeight: 200 }}
                            nestedScrollEnabled
                            showsVerticalScrollIndicator
                          >
                            {chatHistory.map((msg: any) => {
                              const isMe = msg.from_kid_id === kidId;
                              const isChat = msg.type?.startsWith("chat:");
                              const chatText = isChat
                                ? msg.type.slice(5)
                                : null;
                              const reaction = REACTIONS.find(
                                (r) => r.id === msg.type,
                              );
                              const timeStr = new Date(
                                msg.created_at,
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              });
                              const dateStr = new Date(
                                msg.created_at,
                              ).toLocaleDateString(isRTL ? "ar" : "en", {
                                month: "short",
                                day: "numeric",
                              });

                              return (
                                <View
                                  key={msg.id}
                                  style={[
                                    styles.chatBubble,
                                    isMe
                                      ? styles.chatBubbleMe
                                      : styles.chatBubbleThem,
                                  ]}
                                >
                                  {isChat ? (
                                    <Text
                                      style={[
                                        styles.chatBubbleText,
                                        isMe && { color: "#fff" },
                                      ]}
                                    >
                                      {chatText}
                                    </Text>
                                  ) : (
                                    <Text style={{ fontSize: 16 }}>
                                      {reaction?.icon || "❤️"}{" "}
                                      <Text
                                        style={[
                                          styles.chatBubbleText,
                                          isMe && { color: "#fff" },
                                          { fontSize: 12 },
                                        ]}
                                      >
                                        {isRTL
                                          ? reaction?.ar
                                          : reaction?.en || msg.type}
                                      </Text>
                                    </Text>
                                  )}
                                  <Text
                                    style={[
                                      styles.chatTime,
                                      isMe && {
                                        color: "rgba(255,255,255,0.55)",
                                      },
                                    ]}
                                  >
                                    {dateStr} {timeStr}
                                  </Text>
                                </View>
                              );
                            })}
                          </ScrollView>
                        </View>
                      )}

                      {loadingChat && (
                        <Text style={styles.loadingText}>
                          {isRTL ? "جاري التحميل..." : "Loading..."}
                        </Text>
                      )}
                      {!loadingChat && chatHistory.length === 0 && (
                        <Text style={styles.loadingText}>{t.noMessages}</Text>
                      )}

                      {allowChat && (
                        <View style={styles.chatInputRow}>
                          <TextInput
                            style={styles.chatInput}
                            value={
                              chatFriend === (f.kid_id || f.id) ? chatMsg : ""
                            }
                            onChangeText={(v) => {
                              setChatFriend(f.kid_id || f.id);
                              setChatMsg(v);
                            }}
                            placeholder={t.typeMessage}
                            placeholderTextColor={C.textMuted}
                            maxLength={100}
                          />
                          <Pressable
                            style={styles.chatSendBtn}
                            onPress={() => {
                              soundService.play("tab_press");
                              handleSendChat(f.kid_id || f.id);
                            }}
                            disabled={
                              !chatMsg.trim() ||
                              chatFriend !== (f.kid_id || f.id)
                            }
                          >
                            <Text style={styles.chatSendText}>
                              {t.sendMessage}
                            </Text>
                          </Pressable>
                        </View>
                      )}
                      {!allowChat && (
                        <Text style={styles.chatDisabledText}>
                          {t.chatDisabled}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {friends.length === 0 && !friendsLoading && (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 48, marginBottom: 8 }}>👫</Text>
                <Text style={styles.emptyText}>
                  {isRTL
                    ? "لا أصدقاء بعد. شارك كودك!"
                    : "No friends yet. Share your code!"}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            INVITE TAB
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {subTab === "invite" && (
          <View style={styles.section}>
            {/* Add friend by code */}
            <View style={styles.addFriendCard}>
              <Text style={styles.addFriendTitle}>🔍 {t.addFriendByCode}</Text>
              <View style={styles.addFriendRow}>
                <TextInput
                  style={[styles.codeInput, { flex: 1 }]}
                  value={friendCodeInput}
                  onChangeText={setFriendCodeInput}
                  placeholder={t.enterFriendCode}
                  placeholderTextColor={C.textMuted}
                  autoCapitalize="characters"
                  maxLength={10}
                />
                <Pressable
                  style={[
                    styles.addBtnWrap,
                    sendingRequest && { opacity: 0.5 },
                  ]}
                  onPress={() => {
                    soundService.play("tab_press");
                    handleSendFriendRequest();
                  }}
                  disabled={sendingRequest || !friendCodeInput.trim()}
                >
                  <LinearGradient
                    colors={[C.cyan, C.lavender]}
                    style={styles.addBtnInner}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.addBtnText}>
                      {sendingRequest ? "⏳" : `➕ ${t.addFriend}`}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>

            {/* My code card */}
            <LinearGradient
              colors={["#0D0033", "#1A0055"]}
              style={styles.myCodeCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.myCodeCardWatermark}>📨</Text>
              <Text style={{ fontSize: 44, textAlign: "center" }}>📨</Text>
              <Text style={styles.myCodeTitle}>{t.inviteTitle}</Text>
              <Text style={styles.myCodeDesc}>{t.inviteDesc}</Text>

              <View style={styles.codeDisplayRow}>
                <Text style={styles.codeDisplayText}>
                  {activeKid?.friend_code || "ATHK0000"}
                </Text>
                <Pressable
                  style={[
                    styles.copyBtn,
                    copied && { backgroundColor: C.mint },
                  ]}
                  onPress={() => {
                    soundService.play("tab_press");
                    handleCopyCode();
                  }}
                >
                  <Text style={styles.copyBtnText}>
                    {copied ? `✅ ${t.copied}` : `${t.copy}`}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={styles.shareBtn}
                onPress={() => {
                  soundService.play("tab_press");
                  handleShare();
                }}
              >
                <Text style={styles.shareBtnText}>📤 {t.shareBtn}</Text>
              </Pressable>

              <View style={styles.rewardInfoBox}>
                <Text style={styles.rewardInfoTitle}>{t.perFriend}</Text>
                <Text style={styles.rewardInfoDesc}>{t.youGet}</Text>
              </View>
            </LinearGradient>

            {/* Social badges */}
            <Text style={styles.sectionLabel}>{t.friendBadges}</Text>
            {SOCIAL_BADGES.map((b) => {
              const got = friends.length >= b.req;
              return (
                <View
                  key={b.id}
                  style={[styles.badgeCard, !got && { opacity: 0.45 }]}
                >
                  <LinearGradient
                    colors={
                      got
                        ? [C.mintDim, C.mintBorder]
                        : ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.06)"]
                    }
                    style={styles.badgeIconWrap}
                  >
                    <Text style={{ fontSize: 26 }}>{b.icon}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.badgeName}>
                      {isRTL ? b.nameAr : b.nameEn}
                    </Text>
                    <Text style={styles.badgeDesc}>
                      {isRTL ? b.descAr : b.descEn}
                    </Text>
                  </View>
                  {got ? (
                    <View style={styles.badgeEarnedPill}>
                      <Text style={styles.badgeEarnedText}>✅</Text>
                    </View>
                  ) : (
                    <View style={styles.badgeProgressPill}>
                      <Text style={styles.badgeProgressText}>
                        {friends.length}/{b.req}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // ── Header ──
  header: {
    paddingHorizontal: 20,
    paddingTop: 62,
    paddingBottom: 22,
    position: "relative",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
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
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,107,157,0.06)",
    bottom: -40,
    left: 50,
  },
  microStar: {
    position: "absolute",
    borderRadius: 2,
    backgroundColor: "#fff",
    opacity: 0.45,
  },
  headerIconWrap: { flexShrink: 0 },
  headerIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: C.coralBorder,
    shadowColor: C.coral,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: C.coral,
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

  // ── Stats ──
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 16,
    marginBottom: 4,
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

  // ── Disabled banner ──
  disabledBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: "rgba(255,107,157,0.1)",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: C.coralBorder,
  },
  disabledText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.coral,
    flex: 1,
  },

  // ── Tabs ──
  tabActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: C.lavender,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  tabInactive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  tabEmoji: { fontSize: 14 },
  tabTextActive: { fontSize: 12, fontWeight: "800", color: "#fff" },
  tabText: { fontSize: 12, fontWeight: "700", color: C.textMuted },

  section: { paddingHorizontal: 16, paddingBottom: 20 },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "900",
    color: C.white,
    marginTop: 20,
    marginBottom: 10,
  },

  // ── Podium ──
  podiumWrap: {
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  podium: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 8,
  },
  podiumItem: { alignItems: "center", flex: 1 },
  podiumCrown: { position: "absolute", top: -28, zIndex: 1 },
  podiumAvatar: { fontSize: 32, marginBottom: 6 },
  podiumBlock: {
    width: "100%",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 8,
  },
  podiumRank: { fontSize: 20 },
  podiumName: {
    fontSize: 11,
    fontWeight: "800",
    color: C.textSub,
    marginTop: 5,
    textAlign: "center",
  },
  podiumStars: { fontSize: 11, fontWeight: "700", color: C.textMuted },

  // ── Leaderboard cards ──
  leaderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.bgCard,
    borderRadius: 18,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.bgCardBorder,
  },
  leaderCardGold: {
    backgroundColor: C.goldDim,
    borderColor: C.goldBorder,
    shadowColor: C.gold,
    shadowOpacity: 0.2,
  },
  leaderCardMe: {
    backgroundColor: C.cyanDim,
    borderColor: C.cyanBorder,
    shadowColor: C.cyan,
    shadowOpacity: 0.2,
  },
  leaderRankEmoji: { fontSize: 18, width: 32, textAlign: "center" },
  leaderAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  leaderLvlBadge: {
    position: "absolute",
    bottom: -4,
    alignSelf: "center",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: C.bg,
  },
  leaderLvlText: { fontSize: 8, fontWeight: "900", color: "#fff" },
  leaderName: { fontSize: 14, fontWeight: "800", color: C.white },
  leaderStats: {
    fontSize: 11,
    fontWeight: "600",
    color: C.textMuted,
    marginTop: 2,
  },
  leaderStarBadge: {
    backgroundColor: C.goldDim,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  leaderStarText: { fontSize: 12, fontWeight: "800", color: C.gold },

  // ── Community challenge card ──
  communityCard: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: C.lavBorder,
    shadowColor: C.lavender,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    overflow: "hidden",
    position: "relative",
  },
  communityWatermark: {
    position: "absolute",
    fontSize: 110,
    opacity: 0.05,
    right: -10,
    top: -10,
  },
  communityLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: C.lavender,
    marginBottom: 4,
  },
  communityTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: C.white,
    marginBottom: 6,
    maxWidth: "80%",
  },
  communityDesc: {
    fontSize: 13,
    color: C.textSub,
    marginBottom: 10,
    lineHeight: 19,
  },
  communityBarBg: {
    height: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    overflow: "hidden",
  },
  communityBarFill: { height: "100%", borderRadius: 20 },
  communityMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  communityMetaText: {
    fontSize: 12,
    color: C.textSub,
    fontWeight: "700",
  },
  communityRewardRow: {
    flexDirection: "row",
    marginTop: 8,
    gap: 6,
    flexWrap: "wrap",
  },
  communityRewardBadge: {
    backgroundColor: C.goldDim,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  communityRewardText: { fontSize: 12, fontWeight: "800", color: C.gold },
  contributionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  contributionText: { fontSize: 13, fontWeight: "700", color: C.white },
  startDhikrBtn: { borderRadius: 14, overflow: "hidden", marginTop: 4 },
  startDhikrInner: {
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 14,
  },
  startDhikrText: { color: "#060B27", fontWeight: "900", fontSize: 14 },
  joinBtnWrap: { marginTop: 10 },
  joinBtn: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
  },
  joinBtnText: { color: C.white, fontWeight: "900", fontSize: 14 },

  // ── Pending card ──
  pendingCard: {
    backgroundColor: C.bgCard,
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: C.goldBorder,
  },
  pendingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  pendingAvatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: C.goldDim,
    borderWidth: 1,
    borderColor: C.goldBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingTitle: { fontSize: 14, fontWeight: "800", color: C.white },
  pendingFrom: { fontSize: 12, color: C.textMuted, fontWeight: "600" },
  pendingNewBadge: {
    backgroundColor: C.goldDim,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  pendingNewText: { fontSize: 11, fontWeight: "800", color: C.gold },
  pendingMeta: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: "700",
    marginBottom: 4,
  },
  pendingBtns: { flexDirection: "row", gap: 8, marginTop: 10 },
  parentOnlyText: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 6,
    fontWeight: "600",
  },
  acceptBtn: {
    backgroundColor: C.mintDim,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.mintBorder,
  },
  acceptBtnText: { color: C.mint, fontSize: 12, fontWeight: "800" },
  declineBtn: {
    backgroundColor: C.coralDim,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.coralBorder,
  },
  declineBtnText: { color: C.coral, fontSize: 12, fontWeight: "800" },

  // ── Friend chips ──
  friendChipsCard: {
    backgroundColor: C.bgCard,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: C.bgCardBorder,
  },
  pickLabel: {
    fontSize: 13,
    color: C.textMuted,
    fontWeight: "700",
    marginBottom: 12,
  },
  friendChips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  friendChip: {
    alignItems: "center",
    gap: 4,
    width: (width - 32 - 32 - 20) / 3,
    backgroundColor: C.lavDim,
    borderRadius: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: C.lavBorder,
  },
  friendChipAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  friendChipName: { fontSize: 11, fontWeight: "700", color: C.white },

  // ── Waiting card ──
  waitingCard: {
    backgroundColor: C.bgCard,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.bgCardBorder,
    opacity: 0.65,
  },
  waitingText: { fontSize: 13, fontWeight: "700", color: C.textSub },
  waitingSubText: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 2,
  },

  // ── 1v1 card ──
  oneVOneCard: {
    backgroundColor: C.bgCard,
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: C.lavBorder,
    shadowColor: C.lavender,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  oneVOneCardWin: {
    borderColor: C.mintBorder,
    shadowColor: C.mint,
  },
  oneVOneCardLose: {
    borderColor: C.coralBorder,
    shadowColor: C.coral,
  },
  oneVOneHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  oneVOneTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: C.white,
    flex: 1,
  },
  resultPill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  resultPillWin: {
    backgroundColor: C.mintDim,
    borderWidth: 1,
    borderColor: C.mintBorder,
  },
  resultPillLose: {
    backgroundColor: C.coralDim,
    borderWidth: 1,
    borderColor: C.coralBorder,
  },
  resultPillTie: {
    backgroundColor: C.goldDim,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  resultPillText: { fontSize: 11, fontWeight: "800" },
  oneVOneVs: { flexDirection: "row", alignItems: "center", gap: 8 },
  oneVOnePlayer: { alignItems: "center", flex: 1 },
  oneVOneScore: {
    fontSize: 20,
    fontWeight: "900",
    color: C.cyan,
    marginTop: 4,
  },
  oneVOnePlayerName: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: "700",
    marginTop: 2,
  },
  oneVOneBarWrap: { flex: 2, alignItems: "center", gap: 4 },
  oneVOneBar: {
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  oneVOneBarMe: { backgroundColor: C.cyan, borderRadius: 5 },
  oneVOneBarOp: { backgroundColor: C.gold, borderRadius: 5 },
  oneVOneTimeText: { fontSize: 10, color: C.textMuted, fontWeight: "700" },

  // ── Completed community ──
  completedCard: {
    backgroundColor: C.mintDim,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: C.mintBorder,
  },
  completedCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  completedCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: C.mint,
    flex: 1,
  },
  finishedPill: {
    backgroundColor: "rgba(0,245,160,0.2)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.mintBorder,
  },
  finishedPillText: { fontSize: 11, fontWeight: "700", color: C.mint },
  completedBarFull: {
    height: 8,
    backgroundColor: C.mint,
    borderRadius: 20,
    marginBottom: 6,
    shadowColor: C.mint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  completedMeta: { fontSize: 12, color: C.textSub, fontWeight: "700" },
  rankRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    flexWrap: "wrap",
  },
  rankRowText: { fontSize: 12, color: C.mint, fontWeight: "700" },

  // ── Ended challenge card (rich results) ──
  endedCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
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
  endedTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: C.white,
    marginBottom: 4,
  },
  endedSub: { fontSize: 12, color: C.textSub, fontWeight: "700" },
  endedBadge: {
    backgroundColor: C.mintDim,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.mintBorder,
  },
  endedBadgeText: { fontSize: 11, fontWeight: "800", color: C.mint },
  endedBarBg: {
    height: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 14,
    overflow: "hidden",
  },
  endedBarFill: {
    height: 8,
    borderRadius: 20,
    width: "100%",
  },
  endedPodium: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  endedPodiumTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: C.gold,
    textAlign: "center",
    marginBottom: 10,
  },
  endedPodiumRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
  },
  endedWinner: {
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 80,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  endedWinnerMe: {
    backgroundColor: C.cyanDim,
    borderColor: C.cyanBorder,
  },
  endedWinnerName: {
    fontSize: 11,
    fontWeight: "800",
    color: C.textSub,
    maxWidth: 70,
    textAlign: "center",
  },
  endedWinnerScore: {
    fontSize: 14,
    fontWeight: "900",
    color: C.gold,
  },
  endedMyResult: {
    backgroundColor: "rgba(0,229,255,0.06)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: C.cyanBorder,
  },
  endedMyRank: {
    fontSize: 13,
    fontWeight: "800",
    color: C.cyan,
    marginBottom: 8,
  },
  endedMyStats: {
    flexDirection: "row",
    gap: 8,
  },
  endedStatPill: {
    backgroundColor: C.cyanDim,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.cyanBorder,
  },
  endedStatText: { fontSize: 12, fontWeight: "800", color: C.cyan },

  // ── Friends tab ──
  requestsCard: {
    backgroundColor: C.bgCard,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: C.goldBorder,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  requestsCardHeader: { marginBottom: 6 },
  requestsCardTitle: { fontSize: 14, fontWeight: "800", color: C.gold },
  requestsNote: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: "600",
    marginBottom: 10,
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  requestName: { flex: 1, fontSize: 13, fontWeight: "700", color: C.white },
  waitingLabel: { fontSize: 11, color: C.textMuted, fontWeight: "600" },
  friendsCountLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textMuted,
    marginBottom: 10,
  },
  friendCard: {
    backgroundColor: C.bgCard,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.bgCardBorder,
  },
  friendCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  friendAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  friendLvlBadge: {
    position: "absolute",
    bottom: -4,
    alignSelf: "center",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: C.bg,
  },
  friendLvlText: { fontSize: 8, fontWeight: "900", color: "#fff" },
  friendName: { fontSize: 14, fontWeight: "800", color: C.white },
  friendStats: {
    fontSize: 11,
    fontWeight: "600",
    color: C.textMuted,
    marginTop: 2,
  },
  chatToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.lavDim,
    borderWidth: 1,
    borderColor: C.lavBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  challFriendBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.coralDim,
    borderWidth: 1,
    borderColor: C.coralBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionPanel: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
  },
  reactionGrid: { flexDirection: "row", gap: 6 },
  reactionItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    backgroundColor: C.lavDim,
    borderRadius: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.lavBorder,
  },
  reactionLabel: { fontSize: 9, fontWeight: "700", color: C.textMuted },
  chatBox: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  chatBoxTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textMuted,
    marginBottom: 8,
  },
  chatBubble: {
    maxWidth: "80%",
    borderRadius: 14,
    padding: 10,
    marginBottom: 6,
  },
  chatBubbleMe: {
    backgroundColor: C.lavender,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  chatBubbleThem: {
    backgroundColor: "rgba(255,255,255,0.09)",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  chatBubbleText: { fontSize: 13, fontWeight: "600", color: C.white },
  chatTime: { fontSize: 9, color: C.textMuted, marginTop: 3 },
  loadingText: {
    textAlign: "center",
    fontSize: 12,
    color: C.textMuted,
    fontWeight: "600",
    marginTop: 8,
  },
  chatInputRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  chatInput: {
    flex: 1,
    backgroundColor: C.inputBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: C.white,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: C.inputBorder,
  },
  chatSendBtn: {
    backgroundColor: C.lavender,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    justifyContent: "center",
  },
  chatSendText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  chatDisabledText: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 6,
    textAlign: "center",
    fontWeight: "600",
  },

  // ── Invite tab ──
  addFriendCard: {
    backgroundColor: C.bgCard,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.bgCardBorder,
  },
  addFriendTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: C.white,
    marginBottom: 10,
  },
  addFriendRow: { flexDirection: "row", gap: 8 },
  codeInput: {
    backgroundColor: C.inputBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "700",
    color: C.white,
    borderWidth: 1,
    borderColor: C.inputBorder,
  },
  addBtnWrap: { borderRadius: 12, overflow: "hidden" },
  addBtnInner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnText: { color: "#060B27", fontWeight: "900", fontSize: 13 },

  myCodeCard: {
    borderRadius: 24,
    padding: 22,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: C.lavBorder,
    shadowColor: C.lavender,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    alignItems: "center",
    gap: 6,
    overflow: "hidden",
    position: "relative",
  },
  myCodeCardWatermark: {
    position: "absolute",
    fontSize: 100,
    opacity: 0.05,
    right: -10,
    top: -10,
  },
  myCodeTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: C.white,
    textAlign: "center",
    marginTop: 4,
  },
  myCodeDesc: {
    fontSize: 13,
    color: C.textSub,
    textAlign: "center",
    fontWeight: "600",
  },
  codeDisplayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  codeDisplayText: {
    flex: 1,
    fontSize: 24,
    fontWeight: "900",
    color: C.gold,
    letterSpacing: 4,
    textAlign: "center",
  },
  copyBtn: {
    backgroundColor: C.lavender,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  copyBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  shareBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 24,
    alignItems: "center",
    width: "100%",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  shareBtnText: { color: C.white, fontSize: 14, fontWeight: "800" },
  rewardInfoBox: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 12,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  rewardInfoTitle: { fontSize: 13, fontWeight: "800", color: C.gold },
  rewardInfoDesc: {
    fontSize: 12,
    color: C.textSub,
    marginTop: 3,
    fontWeight: "600",
  },
  badgeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.bgCard,
    borderRadius: 18,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.bgCardBorder,
  },
  badgeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.mintBorder,
  },
  badgeName: { fontSize: 14, fontWeight: "800", color: C.white },
  badgeDesc: {
    fontSize: 11,
    fontWeight: "600",
    color: C.textMuted,
    marginTop: 2,
  },
  badgeEarnedPill: {
    backgroundColor: C.mintDim,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.mintBorder,
  },
  badgeEarnedText: { fontSize: 14 },
  badgeProgressPill: {
    backgroundColor: C.goldDim,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  badgeProgressText: { fontSize: 12, fontWeight: "800", color: C.gold },

  // ── Modals ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#0D1040",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
    overflow: "hidden",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 4,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 0,
  },
  modalHeaderGrad: {
    padding: 20,
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  modalHeaderEmoji: { fontSize: 40 },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: C.white,
    textAlign: "center",
  },
  modalFriendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  modalFriendName: { fontSize: 15, fontWeight: "800", color: C.white },
  modalLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: C.white,
    paddingHorizontal: 20,
    marginBottom: 8,
    marginTop: 8,
  },
  templateBtn: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  templateBtnActive: {
    borderColor: C.lavBorder,
    backgroundColor: C.lavDim,
  },
  templateName: { fontSize: 14, fontWeight: "800", color: C.white },
  templateDhikr: { fontSize: 13, marginTop: 4, color: C.textSub },
  templateMeta: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: "700",
    marginTop: 4,
  },
  modalActionWrap: {
    marginHorizontal: 20,
    borderRadius: 18,
    overflow: "hidden",
  },
  fullBtn: {
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
  },
  fullBtnText: { color: "#060B27", fontSize: 16, fontWeight: "900" },

  // ── Detail modal ──
  detailHeader: {
    padding: 20,
    alignItems: "center",
    gap: 6,
  },
  detailHeaderEmoji: { fontSize: 48 },
  detailHeaderTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: C.white,
    textAlign: "center",
  },
  resultBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: 4,
  },
  resultBadgeText: { fontSize: 13, fontWeight: "900", color: C.white },
  vsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  vsPlayer: { flex: 1, alignItems: "center", gap: 4 },
  vsAvatar: { fontSize: 40 },
  vsName: { fontSize: 13, fontWeight: "800", color: C.white },
  vsScore: { fontSize: 28, fontWeight: "900", color: C.cyan },
  vsLabel: { fontSize: 11, color: C.textMuted, fontWeight: "600" },
  vsCenter: { alignItems: "center" },
  vsText: { fontSize: 22, fontWeight: "900", color: C.textMuted },
  vsBar: {
    flexDirection: "row",
    height: 14,
    borderRadius: 7,
    overflow: "hidden",
    marginHorizontal: 20,
    marginBottom: 12,
  },
  vsBarMe: { backgroundColor: C.cyan, borderRadius: 7 },
  vsBarOp: { backgroundColor: C.gold, borderRadius: 7 },
  detailMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  detailMetaText: {
    fontSize: 12,
    color: C.textMuted,
    fontWeight: "600",
  },
  rewardBox: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.mintBorder,
  },
  rewardBoxText: { fontSize: 15, fontWeight: "800", color: C.mint },
  closeBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  closeBtnText: { color: C.textMuted, fontSize: 14, fontWeight: "800" },

  // ── Misc ──
  emptyState: { alignItems: "center", paddingVertical: 36 },
  emptyText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.textMuted,
    textAlign: "center",
  },
  emptySubText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textMuted,
    textAlign: "center",
    marginTop: 4,
  },

  // ── C.mintDim helper (used in badgeIconWrap) ──
  mintDim: { backgroundColor: C.mintDim },
  mintBorder: { borderColor: C.mintBorder },
});
