import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { ToastState } from "@/hooks/useToast";

/* ─── Brand-aligned toast configs ──────────────────────────────
   Uses the deep-card surface from the Night Sky system.
   Colors are intentionally dark + glowing rather than light pastel.
   ─────────────────────────────────────────────────────────── */
const CONFIGS = {
  success: {
    grad: ["#065F46", "#059669"] as [string, string],
    glow: "rgba(5,150,105,0.45)",
    border: "rgba(52,211,153,0.30)",
    icon: "✅",
    iconBg: "rgba(52,211,153,0.18)",
  },
  error: {
    grad: ["#7F1D1D", "#DC2626"] as [string, string],
    glow: "rgba(220,38,38,0.45)",
    border: "rgba(248,113,113,0.30)",
    icon: "❌",
    iconBg: "rgba(248,113,113,0.18)",
  },
  info: {
    grad: ["#1E1A40", "#4C1D95"] as [string, string],
    glow: "rgba(124,58,237,0.40)",
    border: "rgba(167,139,250,0.30)",
    icon: "💡",
    iconBg: "rgba(167,139,250,0.18)",
  },
  warning: {
    grad: ["#78350F", "#D97706"] as [string, string],
    glow: "rgba(217,119,6,0.45)",
    border: "rgba(251,191,36,0.30)",
    icon: "⚠️",
    iconBg: "rgba(251,191,36,0.18)",
  },
};

export function Toast({ toast }: { toast: ToastState | null }) {
  const slideY = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (!toast) return;
    /* Slide up + fade + scale in */
    Animated.parallel([
      Animated.spring(slideY, {
        toValue: 0,
        tension: 200,
        friction: 14,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 200,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, [toast]);

  if (!toast) return null;

  const cfg =
    CONFIGS[(toast.type ?? "success") as keyof typeof CONFIGS] ??
    CONFIGS.success;

  return (
    <Animated.View
      style={[
        S.outerWrap,
        {
          shadowColor: cfg.glow,
          opacity,
          transform: [{ translateY: slideY }, { scale }],
        },
      ]}
      pointerEvents="none"
    >
      {/* Outer border glow ring */}
      <View style={[S.borderRing, { borderColor: cfg.border }]} />

      <LinearGradient
        colors={cfg.grad}
        style={S.inner}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Top shine */}
        <View style={S.shine} />

        {/* Icon bubble */}
        <View style={[S.iconBubble, { backgroundColor: cfg.iconBg }]}>
          <Text style={S.iconText}>{cfg.icon}</Text>
        </View>

        {/* Message */}
        <Text style={S.msg} numberOfLines={3}>
          {toast.msg}
        </Text>
      </LinearGradient>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  outerWrap: {
    position: "absolute",
    bottom: 54,
    alignSelf: "center",
    maxWidth: "88%",
    zIndex: 9999,
    borderRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 18,
  },
  /* Overlay border ring sitting just outside gradient */
  borderRing: {
    position: "absolute",
    inset: -1,
    borderRadius: 23,
    borderWidth: 1.5,
    zIndex: 1,
    pointerEvents: "none",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 22,
    overflow: "hidden",
  },
  shine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  iconText: { fontSize: 16 },
  msg: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
});
