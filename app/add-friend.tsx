import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Share,
} from "react-native";
import { router } from "expo-router";
import { COLORS } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { friendsService } from "@/services/friends";
import { useToast } from "@/hooks/useToast";
import { Toast } from "@/components/ui";

export default function AddFriendScreen() {
  const { activeKid } = useAuth();
  const { lang } = useLang();
  const isRTL = lang === "ar";

  const [friendCode, setFriendCode] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast, showToast } = useToast();

  const myCode = activeKid?.friend_code || "";

  const handleSendRequest = async () => {
    if (!friendCode.trim() || !activeKid) return;
    if (friendCode.trim().toUpperCase() === myCode.toUpperCase()) {
      showToast(
        isRTL ? "لا يمكنك إضافة نفسك!" : "You can't add yourself!",
        "error",
      );
      return;
    }

    setSending(true);
    try {
      await friendsService.sendRequest(activeKid.id, friendCode.trim());
      setSent(true);
      showToast(
        isRTL
          ? "تم إرسال طلب الصداقة. ينتظر موافقة ولي الأمر"
          : "Friend request sent. Waiting for parent approval",
      );
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSending(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: isRTL
          ? `أضفني في أذكاري! كود الصداقة: ${myCode} 🌟`
          : `Add me on Athkari! Friend code: ${myCode} 🌟`,
      });
    } catch {}
  };

  return (
    <View style={styles.container}>
      <Toast toast={toast} />
      {/* Close */}
      <Pressable style={styles.closeBtn} onPress={() => router.back()}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>

      <Text style={styles.emoji}>👫</Text>
      <Text style={styles.title}>{isRTL ? "أضف صديق" : "Add Friend"}</Text>

      {/* My code */}
      <View style={styles.myCodeCard}>
        <Text style={styles.myCodeLabel}>
          {isRTL ? "كود صداقتك" : "Your Friend Code"}
        </Text>
        <Text style={styles.myCode}>{myCode || "---"}</Text>
        <Pressable style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>
            {isRTL ? "مشاركة 📤" : "Share 📤"}
          </Text>
        </Pressable>
      </View>

      {/* Enter friend code */}
      <Text style={styles.sectionLabel}>
        {isRTL ? "أدخل كود صديقك" : "Enter Friend's Code"}
      </Text>
      <TextInput
        style={[styles.input, isRTL && { textAlign: "right" }]}
        value={friendCode}
        onChangeText={setFriendCode}
        placeholder={isRTL ? "كود الصديق..." : "Friend code..."}
        placeholderTextColor={COLORS.textMuted}
        autoCapitalize="characters"
        maxLength={20}
      />

      <Pressable
        style={[
          styles.sendBtn,
          (!friendCode.trim() || sending || sent) && { opacity: 0.5 },
        ]}
        onPress={handleSendRequest}
        disabled={!friendCode.trim() || sending || sent}
      >
        <Text style={styles.sendBtnText}>
          {sent
            ? isRTL
              ? "✅ تم الإرسال"
              : "✅ Sent"
            : sending
              ? isRTL
                ? "جارٍ الإرسال..."
                : "Sending..."
              : isRTL
                ? "إرسال طلب صداقة 🤝"
                : "Send Friend Request 🤝"}
        </Text>
      </Pressable>

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>
          {isRTL ? "ℹ️ كيف تعمل الصداقة؟" : "ℹ️ How does friendship work?"}
        </Text>
        <Text style={styles.infoText}>
          {isRTL
            ? "1. شارك كودك مع صديقك\n2. يدخل صديقك كودك في التطبيق\n3. يوافق ولي أمر كل طفل\n4. تصبحون أصدقاء وتتنافسون معاً!"
            : "1. Share your code with a friend\n2. Your friend enters your code\n3. Each parent approves\n4. You become friends and compete together!"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  closeBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: COLORS.textSecondary, fontSize: 18 },
  emoji: { fontSize: 48, textAlign: "center", marginBottom: 8 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 24,
  },
  myCodeCard: {
    backgroundColor: COLORS.primary + "15",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.primary + "30",
    marginBottom: 28,
  },
  myCodeLabel: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 8 },
  myCode: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: 4,
    marginBottom: 12,
  },
  shareBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  shareBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 10,
  },
  input: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    textAlign: "center",
    letterSpacing: 2,
  },
  sendBtn: {
    backgroundColor: COLORS.green,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 28,
  },
  sendBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  infoCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
});
