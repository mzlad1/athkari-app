import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Modal,
  Dimensions,
  RefreshControl,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useLang } from "@/contexts/LangContext";
import { COLORS } from "@/constants/theme";
import { T } from "@/constants/translations";
import { useAuth } from "@/contexts/AuthContext";
import { useFriends } from "@/hooks/useFriends";
import { friendsService } from "@/services/friends";
import { LinearGradient } from "expo-linear-gradient";
import { useToast } from "@/hooks/useToast";
import { Toast } from "@/components/ui";

const REACTION_LABELS: Record<
  string,
  { en: string; ar: string; icon: string }
> = {
  well_done: { en: "Well done!", ar: "أحسنت!", icon: "👏" },
  keep_going: { en: "Keep going!", ar: "يلا كمّل!", icon: "💪" },
  masha_allah: { en: "Masha'Allah!", ar: "ما شاء الله!", icon: "🌟" },
  challenge_me: { en: "Challenge me?", ar: "تبي تتحدى?", icon: "⚔️" },
};

export default function FriendsScreen() {
  const { family, kids } = useAuth();
  const { lang } = useLang();
  const isRTL = lang === "ar";
  const t = T[lang];

  const [selectedKid, setSelectedKid] = useState(0);
  const kid = kids[selectedKid] || kids[0];
  const kidId = kid?.id || null;

  const { friends, refresh: refreshFriendsList } = useFriends(
    kidId || undefined,
  );

  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [removedFriends, setRemovedFriends] = useState(new Set<string>());
  const [friendCodeInput, setFriendCodeInput] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const { toast, showToast } = useToast();

  const [viewChatFriendId, setViewChatFriendId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    if (family?.id) loadPendingRequests();
  }, [family?.id]);

  useEffect(() => {
    if (!kidId || !viewChatFriendId) {
      setChatHistory([]);
      return;
    }
    setChatLoading(true);
    friendsService
      .getChatHistory(kidId, viewChatFriendId)
      .then(setChatHistory)
      .catch(() => setChatHistory([]))
      .finally(() => setChatLoading(false));
  }, [kidId, viewChatFriendId]);

  const loadPendingRequests = async () => {
    if (!family?.id) return;
    try {
      const reqs = await friendsService.getPendingRequests(family.id);
      setPendingRequests(reqs || []);
    } catch {}
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      await friendsService.approveRequest(requestId);
      await loadPendingRequests();
      await refreshFriendsList();
      showToast(isRTL ? "تمت الموافقة" : "Friend approved");
    } catch (e: any) {
      showToast(e.message, "error");
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await friendsService.rejectRequest(requestId);
      await loadPendingRequests();
    } catch {}
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!kidId) return;
    setRemovedFriends((s) => {
      const n = new Set(s);
      n.add(friendId);
      return n;
    });
    showToast(t.friendRemoved);
    try {
      await friendsService.removeFriend(kidId, friendId);
      await refreshFriendsList();
    } catch {}
  };

  const handleSendFriendRequest = async () => {
    if (!kidId || !friendCodeInput.trim()) return;
    if (friendCodeInput.trim() === kid?.friend_code) {
      showToast(
        isRTL ? "لا يمكنك إضافة نفسك" : "You can't add yourself",
        "error",
      );
      return;
    }
    setSendingRequest(true);
    try {
      await friendsService.sendRequest(kidId, friendCodeInput.trim());
      showToast(isRTL ? "تم إرسال الطلب" : "Request sent");
      setFriendCodeInput("");
    } catch (e: any) {
      showToast(
        e.message || (isRTL ? "الكود غير صحيح" : "Invalid code"),
        "error",
      );
    } finally {
      setSendingRequest(false);
    }
  };

  const visibleFriends = friends.filter((f: any) => !removedFriends.has(f.id));
  const chatFriend = visibleFriends.find((x: any) => x.id === viewChatFriendId);

  return (
    <View style={{ flex: 1, backgroundColor: "#FFF7ED" }}>
      <Toast toast={toast} />

      {/* ━━━ HERO HEADER ━━━ */}
      <LinearGradient
        colors={["#10B981", "#059669", "#047857"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerWatermark}>🤝</Text>
        <Text style={styles.headerTitle}>
          {isRTL ? "👫 الأصدقاء" : "👫 Friends"}
        </Text>
        <Text style={styles.headerSub}>
          {isRTL ? "إدارة أصدقاء طفلك" : "Manage your child's friends"}
        </Text>

        {/* Kid Pills */}
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
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={async () => {
              await refreshFriendsList();
            }}
            tintColor="#7C3AED"
            colors={["#7C3AED"]}
          />
        }
      >
        {/* ── Friend Code Hero Card ── */}
        {kid?.friend_code && (
          <LinearGradient
            colors={["#7C3AED", "#9333EA"]}
            style={styles.friendCodeCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.friendCodeWatermark}>🔗</Text>
            <Text style={styles.friendCodeLabel}>{t.yourCode}</Text>
            <View style={styles.friendCodePill}>
              <Text style={styles.friendCodeText}>{kid.friend_code}</Text>
            </View>
            <Text style={styles.friendCodeHint}>
              {isRTL
                ? "📤 شارك هذا الرمز مع أصدقائك!"
                : "📤 Share this code with friends!"}
            </Text>
          </LinearGradient>
        )}

        {/* ── Add Friend ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>➕ {t.addFriend}</Text>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <TextInput
              style={[
                styles.codeInput,
                { textAlign: isRTL ? "right" : "left" },
              ]}
              value={friendCodeInput}
              onChangeText={setFriendCodeInput}
              placeholder={isRTL ? "أدخل كود الصديق" : "Enter friend code"}
              placeholderTextColor="#A78BFA"
              autoCapitalize="characters"
            />
            <Pressable
              onPress={handleSendFriendRequest}
              disabled={!friendCodeInput.trim() || sendingRequest}
            >
              <LinearGradient
                colors={["#F97316", "#FB923C"]}
                style={[
                  styles.sendBtn,
                  (!friendCodeInput.trim() || sendingRequest) && {
                    opacity: 0.4,
                  },
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.sendBtnText}>
                  {sendingRequest ? "⏳" : `🚀 ${t.sendRequest}`}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>

        {/* ── Pending Requests ── */}
        {pendingRequests.length > 0 && (
          <LinearGradient
            colors={["#FEF3C7", "#FDE68A"]}
            style={[styles.card, { borderWidth: 2, borderColor: "#F59E0B" }]}
          >
            <Text style={[styles.cardTitle, { color: "#92400E" }]}>
              ⏳ {t.pendReq} ({pendingRequests.length})
            </Text>
            {pendingRequests.map((req: any, idx: number) => (
              <View
                key={req.id}
                style={[
                  styles.pendRow,
                  idx === pendingRequests.length - 1 && {
                    borderBottomWidth: 0,
                  },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View style={styles.pendAvatar}>
                    <Text style={{ fontSize: 26 }}>
                      {req.from_kid?.avatar || "🌟"}
                    </Text>
                  </View>
                  <Text style={styles.pendName}>
                    {req.from_kid?.name || "?"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    style={styles.approveBtn}
                    onPress={() => handleApproveRequest(req.id)}
                  >
                    <Text style={styles.approveBtnText}>✅ {t.approve}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.rejectBtn}
                    onPress={() => handleRejectRequest(req.id)}
                  >
                    <Text style={styles.rejectBtnText}>❌ {t.rejectF}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </LinearGradient>
        )}

        {/* ── Current Friends ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            👫 {t.currentFriends} ({visibleFriends.length})
          </Text>

          {visibleFriends.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 48 }}>🌱</Text>
              <Text style={styles.emptyTitle}>
                {isRTL ? "لا أصدقاء حتى الآن" : "No friends yet!"}
              </Text>
              <Text style={styles.emptyHint}>
                {isRTL
                  ? "أضف صديقاً باستخدام الكود أعلاه"
                  : "Add a friend using the code above"}
              </Text>
            </View>
          ) : (
            visibleFriends.map((f: any, idx: number) => (
              <View
                key={f.id}
                style={[
                  styles.friendRow,
                  idx === visibleFriends.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View style={styles.friendAvatar}>
                    <Text style={{ fontSize: 26 }}>
                      {f.avatar_emoji || f.avatar || "🌟"}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.friendName}>
                      {f.display_name || f.name}
                    </Text>
                    {f.streak != null && (
                      <Text style={styles.friendMeta}>
                        🔥 {f.streak} • ⭐ {f.stars || 0}
                      </Text>
                    )}
                  </View>
                </View>
                <View
                  style={{ flexDirection: "row", gap: 6, alignItems: "center" }}
                >
                  <Pressable
                    style={styles.viewChatBtn}
                    onPress={() => setViewChatFriendId(f.id)}
                  >
                    <Text style={styles.viewChatBtnText}>💬</Text>
                  </Pressable>
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() => handleRemoveFriend(f.id)}
                  >
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ━━━ CHAT HISTORY MODAL ━━━ */}
      <Modal
        visible={!!viewChatFriendId}
        transparent
        animationType="slide"
        onRequestClose={() => setViewChatFriendId(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setViewChatFriendId(null)}
          />
          <View style={styles.chatModal}>
            {/* Chat Header */}
            <LinearGradient
              colors={["#7C3AED", "#9333EA"]}
              style={styles.chatModalHeader}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.chatModalHandleBg} />
              <View style={styles.chatModalHandle} />
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  flex: 1,
                }}
              >
                <Text style={{ fontSize: 28 }}>
                  {chatFriend?.avatar || chatFriend?.avatar || "🌟"}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chatModalTitle} numberOfLines={1}>
                    {kid?.name || "Kid"} ↔{" "}
                    {chatFriend?.name || chatFriend?.name || "Friend"}
                  </Text>
                  <Text style={styles.chatModalSub}>
                    {isRTL ? "💬 سجل المحادثة" : "💬 Chat history"}
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.chatCloseBtn}
                onPress={() => setViewChatFriendId(null)}
              >
                <Text style={styles.chatCloseBtnText}>✕</Text>
              </Pressable>
            </LinearGradient>

            {chatLoading ? (
              <View style={styles.chatLoadingWrap}>
                <Text style={{ fontSize: 36 }}>⏳</Text>
                <Text style={styles.chatLoading}>
                  {isRTL ? "جاري التحميل..." : "Loading..."}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={{ flex: 1, backgroundColor: "#FFF7ED" }}
                contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                bounces
              >
                {chatHistory.length === 0 && (
                  <View style={styles.chatEmptyState}>
                    <Text style={{ fontSize: 44 }}>🌱</Text>
                    <Text style={styles.chatEmpty}>
                      {isRTL ? "لا توجد رسائل بعد" : "No messages yet"}
                    </Text>
                  </View>
                )}
                {chatHistory.map((msg: any) => {
                  const fromKid = msg.from_kid_id === kidId;
                  const name = fromKid
                    ? kid?.name || "Kid"
                    : chatFriend?.name || chatFriend?.name || "Friend";
                  const isChat = msg.type?.startsWith?.("chat:");
                  const chatText = isChat ? msg.type.slice(5) : null;
                  const reaction = REACTION_LABELS[msg.type];
                  const time = msg.created_at
                    ? new Date(msg.created_at).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";
                  return (
                    <View
                      key={msg.id}
                      style={[
                        styles.chatBubbleWrap,
                        fromKid
                          ? { alignItems: "flex-start" }
                          : { alignItems: "flex-end" },
                      ]}
                    >
                      <View
                        style={[
                          styles.chatBubble,
                          fromKid
                            ? styles.chatBubbleKid
                            : styles.chatBubbleFriend,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chatBubbleName,
                            fromKid
                              ? { color: "#7C3AED" }
                              : { color: "#059669" },
                          ]}
                        >
                          {fromKid ? "🧒" : "👤"} {name}
                        </Text>
                        {chatText != null ? (
                          <Text style={styles.chatBubbleText}>{chatText}</Text>
                        ) : (
                          <Text style={styles.chatBubbleText}>
                            {reaction
                              ? isRTL
                                ? reaction.ar
                                : reaction.en
                              : msg.type}{" "}
                            {reaction?.icon || ""}
                          </Text>
                        )}
                        <Text style={styles.chatBubbleTime}>{time}</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // ━━━ HEADER ━━━
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
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
    fontSize: 26,
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

  // Kid Pills
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

  // Friend Code Card
  friendCodeCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  friendCodeWatermark: {
    position: "absolute",
    fontSize: 110,
    opacity: 0.08,
    right: -10,
    top: -10,
  },
  friendCodeLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "rgba(255,255,255,0.8)",
    marginBottom: 10,
  },
  friendCodePill: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 18,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  friendCodeText: {
    fontSize: 30,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 10,
  },
  friendCodeHint: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
  },

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
    fontSize: 16,
    fontWeight: "900",
    color: "#1C1917",
    marginBottom: 14,
  },

  // Add Friend
  codeInput: {
    flex: 1,
    padding: 14,
    borderWidth: 2,
    borderColor: "#EDE9FE",
    borderRadius: 16,
    fontSize: 16,
    letterSpacing: 2,
    color: "#1C1917",
    backgroundColor: "#FAFAF9",
    fontWeight: "700",
  },
  sendBtn: { paddingHorizontal: 18, paddingVertical: 14, borderRadius: 16 },
  sendBtnText: { color: "#fff", fontWeight: "900", fontSize: 13 },

  // Pending
  pendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(245,158,11,0.2)",
    flexWrap: "wrap",
    gap: 8,
  },
  pendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  pendName: { fontSize: 14, fontWeight: "800", color: "#1C1917" },
  approveBtn: {
    backgroundColor: "#10B981",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  approveBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  rejectBtn: {
    backgroundColor: "#EF4444",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  rejectBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  // Friends List
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#FEF3C7",
  },
  friendAvatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  friendName: { fontSize: 14, fontWeight: "800", color: "#1C1917" },
  friendMeta: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A8A29E",
    marginTop: 2,
  },
  viewChatBtn: {
    backgroundColor: "#EDE9FE",
    borderRadius: 12,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  viewChatBtnText: { fontSize: 18 },
  deleteBtn: {
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: { fontSize: 18 },

  // Empty State
  emptyState: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "900", color: "#1C1917" },
  emptyHint: {
    fontSize: 12,
    fontWeight: "700",
    color: "#A8A29E",
    textAlign: "center",
  },

  // Chat Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  chatModal: {
    backgroundColor: "#FFF7ED",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: "72%",
    overflow: "hidden",
  },
  chatModalHeader: {
    padding: 20,
    paddingTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    position: "relative",
  },
  chatModalHandleBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  chatModalHandle: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    width: 44,
    height: 5,
    backgroundColor: "rgba(255,255,255,0.4)",
    borderRadius: 50,
    left: "50%",
    marginLeft: -22,
  },
  chatModalTitle: { fontSize: 15, fontWeight: "900", color: "#fff" },
  chatModalSub: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    marginTop: 1,
  },
  chatCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  chatCloseBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  chatLoadingWrap: { alignItems: "center", paddingVertical: 40, gap: 10 },
  chatLoading: { fontSize: 15, fontWeight: "700", color: "#A8A29E" },
  chatEmptyState: { alignItems: "center", paddingVertical: 40, gap: 10 },
  chatEmpty: { fontSize: 15, fontWeight: "700", color: "#A8A29E" },
  chatBubbleWrap: { marginBottom: 10 },
  chatBubble: {
    padding: 12,
    borderRadius: 18,
    maxWidth: "78%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  chatBubbleKid: {
    backgroundColor: "#EDE9FE",
    borderBottomLeftRadius: 6,
  },
  chatBubbleFriend: {
    backgroundColor: "#fff",
    borderBottomRightRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chatBubbleName: { fontSize: 11, fontWeight: "900", marginBottom: 4 },
  chatBubbleText: { fontSize: 14, fontWeight: "700", color: "#1C1917" },
  chatBubbleTime: {
    fontSize: 10,
    fontWeight: "600",
    color: "#A8A29E",
    marginTop: 4,
    textAlign: "right",
  },
});
