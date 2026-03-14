import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { AvatarGrid } from "@/components/ui";
import { supabase } from "@/services/supabase";

const { width } = Dimensions.get("window");

const C = {
  bg: "#06091E",
  bgCard: "rgba(255,255,255,0.05)",
  cyan: "#00E5FF",
  cyanDim: "rgba(0,229,255,0.12)",
  cyanBorder: "rgba(0,229,255,0.25)",
  gold: "#FFD60A",
  goldBorder: "rgba(255,214,10,0.3)",
  white: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.4)",
  textSub: "rgba(255,255,255,0.6)",
  mint: "#00F5A0",
  coral: "#FF6B9D",
};

type AvatarTab = "emoji" | "photo";

// Decode a base64 string to Uint8Array — works in React Native (no atob polyfill needed)
function base64ToUint8Array(base64: string): Uint8Array {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  // strip data-URL prefix if present
  const b64 = base64.includes(",") ? base64.split(",")[1] : base64;
  const len = b64.length;
  let bufLen = Math.ceil(len * 0.75);
  if (b64[len - 1] === "=") bufLen--;
  if (b64[len - 2] === "=") bufLen--;

  const buf = new Uint8Array(bufLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = lookup[b64.charCodeAt(i)];
    const b = lookup[b64.charCodeAt(i + 1)];
    const c = lookup[b64.charCodeAt(i + 2)];
    const d = lookup[b64.charCodeAt(i + 3)];
    buf[p++] = (a << 2) | (b >> 4);
    if (p < bufLen) buf[p++] = ((b & 0xf) << 4) | (c >> 2);
    if (p < bufLen) buf[p++] = ((c & 0x3) << 6) | d;
  }
  return buf;
}

export default function EditProfileScreen() {
  const { activeKid, setActiveKid } = useAuth();
  const { lang } = useLang();
  const isRTL = lang === "ar";

  const [name, setName] = useState(activeKid?.name ?? "");
  const [selectedEmoji, setSelectedEmoji] = useState(
    activeKid?.avatar ?? "🌟",
  );
  const [avatarTab, setAvatarTab] = useState<AvatarTab>(
    activeKid?.avatar_url ? "photo" : "emoji",
  );
  // local photo URI (file:// while unsaved, https:// if already uploaded)
  const [photoUri, setPhotoUri] = useState<string | null>(
    activeKid?.avatar_url ?? null,
  );
  // base64 string of newly picked photo (null if using existing URL)
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [debugMsg, setDebugMsg] = useState<string | null>(null);

  // ── Image picker helpers ─────────────────────────────────────────────
  const pickFromGallery = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        isRTL ? "الإذن مطلوب" : "Permission Required",
        isRTL
          ? "نحتاج إذن الوصول للصور"
          : "We need access to your photo library",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true, // request raw bytes
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64 ?? null);
    }
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        isRTL ? "الإذن مطلوب" : "Permission Required",
        isRTL ? "نحتاج إذن الكاميرا" : "We need camera access",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64 ?? null);
    }
  };

  // ── Upload to Supabase Storage ───────────────────────────────────────
  const uploadImage = async (
    base64: string,
    kidId: string,
  ): Promise<string | null> => {
    console.log("[upload] starting, kidId:", kidId, "b64 len:", base64.length);
    setDebugMsg("Uploading…");
    try {
      const bytes = base64ToUint8Array(base64);
      console.log("[upload] decoded bytes:", bytes.length);

      const fileName = `${kidId}/${Date.now()}.jpg`;
      console.log("[upload] fileName:", fileName);

      const { data, error } = await supabase.storage
        .from("kid-avatars")
        .upload(fileName, bytes, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (error) {
        console.error("[upload] storage error:", JSON.stringify(error));
        setDebugMsg(`Storage error: ${error.message} (${error.statusCode})`);
        return null;
      }

      console.log("[upload] success, path:", data.path);
      const { data: urlData } = supabase.storage
        .from("kid-avatars")
        .getPublicUrl(data.path);

      console.log("[upload] public URL:", urlData.publicUrl);
      setDebugMsg(null);
      return urlData.publicUrl;
    } catch (e: any) {
      console.error("[upload] unexpected error:", e);
      setDebugMsg(`Unexpected: ${String(e?.message ?? e)}`);
      return null;
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!activeKid) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    setSaving(true);

    const updates: Record<string, any> = { name: trimmed };

    if (avatarTab === "photo") {
      if (photoBase64) {
        // New photo picked — upload via base64
        console.log("[save] uploading new photo, base64 len:", photoBase64.length);
        const url = await uploadImage(photoBase64, activeKid.id);
        if (url) {
          updates.avatar_url = url;
        } else {
          setSaving(false);
          Alert.alert(
            isRTL ? "خطأ في الرفع" : "Upload Error",
            isRTL
              ? `تعذّر رفع الصورة\n${debugMsg ?? ""}`
              : `Failed to upload photo\n${debugMsg ?? ""}`,
          );
          return;
        }
      } else if (!photoUri) {
        // Photo was removed
        updates.avatar_url = null;
      }
      // else: photoUri is an existing https URL → nothing changed
    } else {
      // Emoji tab selected → clear any uploaded photo
      updates.avatar = selectedEmoji;
      updates.avatar_url = null;
    }

    const { error } = await supabase
      .from("kids")
      .update(updates)
      .eq("id", activeKid.id);

    setSaving(false);

    if (!error) {
      setActiveKid({ ...activeKid, ...updates });
      router.back();
    } else {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "تعذّر حفظ التغييرات" : "Failed to save changes",
      );
    }
  };

  // ── Live preview values ──────────────────────────────────────────────
  const previewIsPhoto = avatarTab === "photo" && !!photoUri;
  const previewEmoji = selectedEmoji;
  const previewName = name.trim() || (isRTL ? "اسمك" : "Your Name");

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <LinearGradient
          colors={["#0D1040", "#060918"]}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Ambient glow */}
          <View style={styles.blobCyan} />

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={10}
          >
            <Text style={styles.backIcon}>{isRTL ? "→" : "←"}</Text>
          </Pressable>

          <Text style={styles.headerTitle}>
            {isRTL ? "تعديل الملف الشخصي" : "Edit Profile"}
          </Text>

          {/* spacer to centre title */}
          <View style={{ width: 40 }} />
        </LinearGradient>

        {/* ── Live Preview ── */}
        <View style={styles.previewSection}>
          <View style={styles.avatarPreviewOuter}>
            {previewIsPhoto ? (
              <Image
                source={{ uri: photoUri! }}
                style={styles.avatarPreviewImage}
              />
            ) : (
              <View style={styles.avatarPreviewEmoji}>
                <Text style={{ fontSize: 56 }}>{previewEmoji}</Text>
              </View>
            )}
          </View>
          <Text style={styles.previewName} numberOfLines={1}>
            {previewName}
          </Text>
          <Text style={styles.previewSub}>
            {isRTL ? "معاينة مباشرة" : "Live preview"}
          </Text>
        </View>

        {/* ── Name ── */}
        <View style={styles.section}>
          <Text style={styles.label}>{isRTL ? "الاسم" : "Name"}</Text>
          <TextInput
            style={[styles.input, isRTL && { textAlign: "right" }]}
            value={name}
            onChangeText={setName}
            placeholder={isRTL ? "اكتب اسمك" : "Enter your name"}
            placeholderTextColor="rgba(255,255,255,0.25)"
            maxLength={20}
            returnKeyType="done"
          />
        </View>

        {/* ── Avatar type tabs ── */}
        <View style={styles.section}>
          <Text style={styles.label}>
            {isRTL ? "الصورة الرمزية" : "Avatar"}
          </Text>

          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, avatarTab === "emoji" && styles.tabActive]}
              onPress={() => setAvatarTab("emoji")}
            >
              <Text
                style={[
                  styles.tabText,
                  avatarTab === "emoji" && styles.tabTextActive,
                ]}
              >
                {isRTL ? "😊  رموز" : "😊  Emoji"}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tab, avatarTab === "photo" && styles.tabActive]}
              onPress={() => setAvatarTab("photo")}
            >
              <Text
                style={[
                  styles.tabText,
                  avatarTab === "photo" && styles.tabTextActive,
                ]}
              >
                {isRTL ? "📷  صورة" : "📷  Photo"}
              </Text>
            </Pressable>
          </View>

          {/* ── Emoji tab content ── */}
          {avatarTab === "emoji" && (
            <AvatarGrid
              selected={selectedEmoji}
              onSelect={setSelectedEmoji}
            />
          )}

          {/* ── Photo tab content ── */}
          {avatarTab === "photo" && (
            <View style={styles.photoSection}>
              {/* Large photo preview */}
              {photoUri ? (
                <View style={styles.photoPreviewWrapper}>
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.photoPreview}
                  />
                  <Pressable
                    style={styles.removePhotoBtn}
                    onPress={() => { setPhotoUri(null); setPhotoBase64(null); }}
                    hitSlop={6}
                  >
                    <LinearGradient
                      colors={["#3A0020", "#600030"]}
                      style={styles.removePhotoBtnInner}
                    >
                      <Text style={styles.removePhotoBtnText}>
                        {isRTL ? "❌  حذف الصورة" : "❌  Remove Photo"}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.photoEmpty}>
                  <Text style={{ fontSize: 48 }}>🖼️</Text>
                  <Text style={styles.photoEmptyText}>
                    {isRTL
                      ? "اختر صورة من المعرض أو التقط صورة"
                      : "Choose a photo from gallery or take one"}
                  </Text>
                </View>
              )}

              {/* Picker buttons */}
              <View style={styles.photoButtons}>
                <Pressable
                  style={styles.photoBtn}
                  onPress={pickFromGallery}
                  hitSlop={4}
                >
                  <LinearGradient
                    colors={["#1A2A5A", "#0D1A40"]}
                    style={styles.photoBtnInner}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={{ fontSize: 26 }}>🖼️</Text>
                    <Text style={styles.photoBtnText}>
                      {isRTL ? "معرض الصور" : "Gallery"}
                    </Text>
                  </LinearGradient>
                </Pressable>

                <Pressable
                  style={styles.photoBtn}
                  onPress={pickFromCamera}
                  hitSlop={4}
                >
                  <LinearGradient
                    colors={["#1A2A5A", "#0D1A40"]}
                    style={styles.photoBtnInner}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={{ fontSize: 26 }}>📸</Text>
                    <Text style={styles.photoBtnText}>
                      {isRTL ? "الكاميرا" : "Camera"}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* ── Debug message (upload errors) ── */}
        {debugMsg && (
          <View style={styles.debugBox}>
            <Text style={styles.debugText}>⚠️ {debugMsg}</Text>
          </View>
        )}

        {/* ── Save button ── */}
        <Pressable
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <LinearGradient
            colors={[C.cyan, "#009EBB"]}
            style={styles.saveBtnInner}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {saving ? (
              <ActivityIndicator color="#060B27" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>
                {isRTL ? "حفظ التغييرات ✓" : "Save Changes ✓"}
              </Text>
            )}
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 18,
    position: "relative",
    overflow: "hidden",
  },
  blobCyan: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(0,229,255,0.06)",
    top: -60,
    right: -40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: 18,
    color: C.white,
    fontWeight: "800",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: C.white,
  },

  // ── Preview ──
  previewSection: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 8,
  },
  avatarPreviewOuter: {
    width: 100,
    height: 100,
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: C.gold,
    backgroundColor: "#0D1A40",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
  },
  avatarPreviewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  avatarPreviewEmoji: {
    alignItems: "center",
    justifyContent: "center",
  },
  previewName: {
    fontSize: 20,
    fontWeight: "900",
    color: C.white,
    maxWidth: width - 60,
    textAlign: "center",
  },
  previewSub: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // ── Section ──
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  label: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },

  // ── Name input ──
  input: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    color: C.white,
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },

  // ── Avatar tabs ──
  tabs: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 13,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: C.cyanDim,
    borderWidth: 1,
    borderColor: C.cyanBorder,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "800",
    color: C.textMuted,
  },
  tabTextActive: {
    color: C.cyan,
  },

  // ── Photo tab ──
  photoSection: {
    gap: 14,
  },
  photoEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    borderStyle: "dashed",
    gap: 10,
  },
  photoEmptyText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.textMuted,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  photoPreviewWrapper: {
    alignItems: "center",
    gap: 12,
  },
  photoPreview: {
    width: 140,
    height: 140,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: C.cyan,
  },
  removePhotoBtn: {
    borderRadius: 12,
    overflow: "hidden",
  },
  removePhotoBtnInner: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
  },
  removePhotoBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FF6B6B",
  },
  photoButtons: {
    flexDirection: "row",
    gap: 12,
  },
  photoBtn: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  photoBtnInner: {
    paddingVertical: 18,
    alignItems: "center",
    gap: 8,
    borderRadius: 17,
  },
  photoBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: C.white,
  },

  // ── Save button ──
  saveBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: C.cyan,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  saveBtnInner: {
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 18,
  },
  saveBtnText: {
    color: "#060B27",
    fontSize: 16,
    fontWeight: "900",
  },
  debugBox: {
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: "rgba(255,80,80,0.12)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,80,80,0.3)",
  },
  debugText: {
    color: "#FF8080",
    fontSize: 12,
    fontWeight: "700",
  },
});
