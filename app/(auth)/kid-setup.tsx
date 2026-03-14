import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useState, useRef, useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/services/supabase";
import { LinearGradient } from "expo-linear-gradient";
import { useToast } from "@/hooks/useToast";
import { Toast } from "@/components/ui";

const C = {
  skyDeep: "#0F1E35",
  skySurface: "#162945",
  skyCard: "#1E3554",
  gold: "#FFC843",
  goldSoft: "#FFE89A",
  goldBorder: "rgba(255,200,67,0.30)",
  goldGlow: "rgba(255,200,67,0.14)",
  coral: "#FF6B4A",
  mint: "#3DD9A4",
  mintGlow: "rgba(61,217,164,0.14)",
  violet: "#A78BFA",
  violetGlow: "rgba(167,139,250,0.14)",
  white: "#FFFFFF",
  cream: "#F0E8D8",
  muted: "#7A9BBC",
  dim: "#3D5876",
};

const AVATARS = [
  "🦁",
  "🦋",
  "🦅",
  "🌸",
  "🐻",
  "🌺",
  "🐯",
  "🌈",
  "⚽",
  "🎨",
  "🦄",
  "🐬",
];

const AGE_GROUPS = [
  { id: "4-6", labelAr: "٤-٦", labelEn: "4-6" },
  { id: "7-9", labelAr: "٧-٩", labelEn: "7-9" },
  { id: "10-12", labelAr: "١٠-١٢", labelEn: "10-12" },
];

/* ── Twinkling star ─────────────────────────────────────────── */
function StarDot({
  x,
  y,
  size = 2.5,
  delay = 0,
  color = C.gold,
}: {
  x: number;
  y: number;
  size?: number;
  delay?: number;
  color?: string;
}) {
  const anim = useRef(new Animated.Value(0.15)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.15,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: anim,
      }}
    />
  );
}

/* ── Section header ─────────────────────────────────────────── */
function SectionHead({ label, isRTL }: { label: string; isRTL: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
        marginTop: 4,
        alignSelf: "stretch",
      }}
    >
      <View
        style={{
          width: 4,
          height: 16,
          borderRadius: 2,
          backgroundColor: C.gold,
        }}
      />
      <Text
        style={{
          fontSize: 14,
          fontWeight: "800",
          color: C.cream,
          letterSpacing: 0.1,
          ...(isRTL ? { textAlign: "right" } : {}),
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/* ── Age group pill ─────────────────────────────────────────── */
function AgePill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () =>
    Animated.spring(scale, {
      toValue: 0.93,
      useNativeDriver: true,
      tension: 280,
      friction: 10,
    }).start(() =>
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 280,
        friction: 10,
      }).start(),
    );
  return (
    <Pressable
      style={{ flex: 1 }}
      onPress={() => {
        press();
        onPress();
      }}
    >
      <Animated.View
        style={[
          S.agePill,
          selected && S.agePillSelected,
          { transform: [{ scale }] },
        ]}
      >
        {selected && (
          <LinearGradient
            colors={[C.coral, "#E85A3C"]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}
        <Text style={[S.agePillText, selected && S.agePillTextSelected]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function KidSetupScreen() {
  const { lang } = useLang();
  const { activeKid, refreshKids } = useAuth();
  const isRTL = lang === "ar";

  const [avatar, setAvatar] = useState(
    activeKid?.avatar || activeKid?.avatar_emoji || "",
  );
  const [name, setName] = useState(activeKid?.display_name || "");
  const [ageGroup, setAgeGroup] = useState(activeKid?.age_group || "");
  const [loading, setLoading] = useState(false);
  const canContinue = avatar && name.length >= 2 && ageGroup;
  const { toast, showToast } = useToast();

  /* Preview pulse */
  const previewScale = useRef(new Animated.Value(0.8)).current;
  const previewOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (avatar && name) {
      Animated.parallel([
        Animated.spring(previewScale, {
          toValue: 1,
          tension: 200,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(previewOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [avatar, name]);

  const handleContinue = async () => {
    if (!canContinue || !activeKid) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("kids")
        .update({
          display_name: name.trim(),
          avatar_emoji: avatar,
          avatar,
          age_group: ageGroup,
        })
        .eq("id", activeKid.id);
      if (error) throw error;
      await refreshKids();
      router.replace("/(auth)/referral");
    } catch (e: any) {
      showToast(
        e.message || (isRTL ? "حدث خطأ" : "Something went wrong"),
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[C.skyDeep, C.skySurface, "#0F2236"]}
      locations={[0, 0.55, 1]}
      style={{ flex: 1 }}
    >
      <Toast toast={toast} />

      {/* Ambient glows */}
      <View
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: C.goldGlow,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 40,
          left: -60,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: C.mintGlow,
        }}
      />

      {/* Stars */}
      <StarDot x={20} y={60} size={2.5} delay={0} color={C.gold} />
      <StarDot x={350} y={100} size={2} delay={500} color={C.mint} />
      <StarDot x={40} y={300} size={2} delay={900} color={C.violet} />
      <StarDot x={330} y={440} size={2.5} delay={300} color={C.gold} />

      <ScrollView
        contentContainerStyle={S.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={S.header}>
          <View style={S.moonBadge}>
            <LinearGradient
              colors={[C.skyCard, "#243F64"]}
              style={S.moonBadgeInner}
            >
              <Text style={{ fontSize: 36 }}>🧒</Text>
            </LinearGradient>
          </View>
          <Text style={S.title}>
            {isRTL ? "أخبرنا عنك!" : "Build Your Hero! ⚔️"}
          </Text>
          <Text style={S.subtitle}>
            {isRTL
              ? "اختر شخصيتك وأخبرنا اسمك"
              : "Pick your character and enter your name"}
          </Text>
        </View>

        {/* ── Avatar picker ── */}
        <View style={S.section}>
          <SectionHead
            label={isRTL ? "اختر شخصيتك" : "Pick Your Character"}
            isRTL={isRTL}
          />
          <View style={S.avatarGrid}>
            {AVATARS.map((a) => {
              const selected = avatar === a;
              return (
                <Pressable key={a} onPress={() => setAvatar(a)}>
                  <Animated.View
                    style={[S.avatarBtn, selected && S.avatarSelected]}
                  >
                    {selected && (
                      <LinearGradient
                        colors={[
                          "rgba(255,200,67,0.22)",
                          "rgba(255,200,67,0.06)",
                        ]}
                        style={StyleSheet.absoluteFillObject}
                      />
                    )}
                    <Text style={S.avatarEmoji}>{a}</Text>
                    {selected && (
                      <View style={S.avatarCheckDot}>
                        <Text
                          style={{
                            fontSize: 8,
                            color: C.skyDeep,
                            fontWeight: "900",
                          }}
                        >
                          ✓
                        </Text>
                      </View>
                    )}
                  </Animated.View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Name input ── */}
        <View style={S.section}>
          <SectionHead
            label={isRTL ? "ما اسمك يا بطل؟" : "What's your name, champ?"}
            isRTL={isRTL}
          />
          <View style={S.fieldWrap}>
            <TextInput
              style={[S.fieldInput, isRTL && { textAlign: "right" }]}
              placeholder={isRTL ? "اكتب اسمك..." : "Type your name..."}
              placeholderTextColor={C.dim}
              value={name}
              onChangeText={setName}
              maxLength={20}
            />
          </View>
        </View>

        {/* ── Age group ── */}
        <View style={S.section}>
          <SectionHead
            label={isRTL ? "كم عمرك؟" : "How old are you?"}
            isRTL={isRTL}
          />
          <View style={S.ageRow}>
            {AGE_GROUPS.map((ag) => (
              <AgePill
                key={ag.id}
                label={isRTL ? ag.labelAr : ag.labelEn}
                selected={ageGroup === ag.id}
                onPress={() => setAgeGroup(ag.id)}
              />
            ))}
          </View>
        </View>

        {/* ── Live preview ── */}
        {avatar && name ? (
          <Animated.View
            style={[
              S.preview,
              { transform: [{ scale: previewScale }], opacity: previewOpacity },
            ]}
          >
            <LinearGradient
              colors={[C.skyCard, "#243F64"]}
              style={S.previewGrad}
            >
              <View style={S.previewShine} />
              <View style={S.previewAvatarRing}>
                <Text style={{ fontSize: 42 }}>{avatar}</Text>
              </View>
              <Text style={S.previewName}>
                {isRTL ? `مرحباً ${name}! 🌙` : `Hello ${name}! 🌙`}
              </Text>
              <View style={S.previewStarRow}>
                {["⭐ 0 Stars", "🔥 0 Streak"].map((t, i) => (
                  <View key={i} style={S.previewChip}>
                    <Text style={S.previewChipText}>{t}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </Animated.View>
        ) : null}

        {/* ── CTA ── */}
        <Pressable
          onPress={handleContinue}
          disabled={!canContinue || loading}
          style={({ pressed }) => [
            S.ctaWrap,
            (!canContinue || loading || pressed) && {
              opacity: !canContinue || loading ? 0.45 : 0.8,
            },
          ]}
        >
          <LinearGradient
            colors={canContinue ? [C.coral, "#E85A3C"] : [C.dim, "#2E4260"]}
            style={S.ctaBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={S.btnGloss} />
            <Text style={S.ctaText}>
              {loading
                ? isRTL
                  ? "⏳ جارٍ الحفظ..."
                  : "⏳ Saving..."
                : isRTL
                  ? "ابدأ المغامرة! 🌟"
                  : "Start the Adventure! 🌟"}
            </Text>
          </LinearGradient>
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const S = StyleSheet.create({
  scroll: { paddingHorizontal: 22, paddingTop: 56, paddingBottom: 40 },

  header: { alignItems: "center", marginBottom: 28 },
  moonBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: "hidden",
    borderWidth: 2.5,
    borderColor: "rgba(255,200,67,0.28)",
    marginBottom: 14,
    shadowColor: "#FFC843",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  moonBadgeInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7A9BBC",
    textAlign: "center",
    lineHeight: 18,
  },

  section: { marginBottom: 22 },

  /* Avatar grid */
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  avatarBtn: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#1E3554",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
    position: "relative",
  },
  avatarSelected: {
    borderColor: "rgba(255,200,67,0.50)",
    shadowColor: "#FFC843",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarEmoji: { fontSize: 30 },
  avatarCheckDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFC843",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Field */
  fieldWrap: {
    backgroundColor: "#1E3554",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  fieldInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#F0E8D8",
    fontSize: 16,
    fontWeight: "700",
  },

  /* Age row */
  ageRow: { flexDirection: "row", gap: 8 },
  agePill: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "#1E3554",
    overflow: "hidden",
    position: "relative",
  },
  agePillSelected: {
    borderColor: "transparent",
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  agePillText: { fontSize: 16, fontWeight: "800", color: "#7A9BBC" },
  agePillTextSelected: { color: "#FFFFFF" },

  /* Preview */
  preview: {
    marginBottom: 22,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.07)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  previewGrad: { padding: 22, alignItems: "center", overflow: "hidden" },
  previewShine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  previewAvatarRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#162945",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "rgba(255,200,67,0.28)",
    marginBottom: 10,
    shadowColor: "#FFC843",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  previewName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  previewStarRow: { flexDirection: "row", gap: 8 },
  previewChip: {
    backgroundColor: "rgba(255,200,67,0.10)",
    borderWidth: 1.5,
    borderColor: "rgba(255,200,67,0.20)",
    borderRadius: 50,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  previewChipText: { fontSize: 11, fontWeight: "800", color: "#FFC843" },

  /* CTA */
  ctaWrap: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#FF6B4A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaBtn: {
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: "center",
    overflow: "hidden",
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  btnGloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});
