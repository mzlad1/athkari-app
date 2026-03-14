import { View, Text, StyleSheet, Animated } from "react-native";
import { useRef, useEffect as RNuseEffect } from "react";
import { LinearGradient } from "expo-linear-gradient";

/* ─── Preset color themes matching brand system ─────────────── */
export const PROGRESS_THEMES = {
  gold: {
    grad: ["#FFC843", "#E6A800"] as [string, string],
    glow: "rgba(255,200,67,0.45)",
    bg: "rgba(255,200,67,0.12)",
  },
  coral: {
    grad: ["#FF6B4A", "#E85A3C"] as [string, string],
    glow: "rgba(255,107,74,0.40)",
    bg: "rgba(255,107,74,0.12)",
  },
  mint: {
    grad: ["#3DD9A4", "#059669"] as [string, string],
    glow: "rgba(61,217,164,0.40)",
    bg: "rgba(61,217,164,0.12)",
  },
  violet: {
    grad: ["#A78BFA", "#7C3AED"] as [string, string],
    glow: "rgba(167,139,250,0.40)",
    bg: "rgba(167,139,250,0.12)",
  },
  amber: {
    grad: ["#D97706", "#B45309"] as [string, string],
    glow: "rgba(217,119,6,0.40)",
    bg: "rgba(217,119,6,0.12)",
  },
  success: {
    grad: ["#3DD9A4", "#059669"] as [string, string],
    glow: "rgba(52,211,153,0.45)",
    bg: "rgba(52,211,153,0.12)",
  },
};

type ThemeKey = keyof typeof PROGRESS_THEMES;

interface ProgressBarProps {
  value: number; // 0–100
  height?: number;
  theme?: ThemeKey;
  colors?: [string, string]; // manual override
  glowColor?: string;
  bgColor?: string;
  showLabel?: boolean;
  label?: string;
  labelColor?: string;
  showMilestones?: boolean;
  animated?: boolean;
  rounded?: boolean;
}

export function ProgressBar({
  value,
  height = 12,
  theme = "gold",
  colors,
  glowColor,
  bgColor,
  showLabel = false,
  label,
  labelColor,
  showMilestones = false,
  animated = true,
  rounded = true,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const isComplete = pct >= 100;
  const radius = rounded ? height / 2 : 4;

  /* Auto-switch to success theme on complete */
  const activeTheme = isComplete
    ? PROGRESS_THEMES.success
    : (PROGRESS_THEMES[theme] ?? PROGRESS_THEMES.gold);
  const activeGrad = colors ?? activeTheme.grad;
  const activeGlow = glowColor ?? activeTheme.glow;
  const activeBg = bgColor ?? activeTheme.bg;

  /* Animated width */
  const widthAnim = useRef(new Animated.Value(0)).current;
  RNuseEffect(() => {
    if (animated) {
      Animated.spring(widthAnim, {
        toValue: pct,
        tension: 60,
        friction: 10,
        useNativeDriver: false,
      }).start();
    } else {
      widthAnim.setValue(pct);
    }
  }, [pct]);

  /* Shimmer animation on complete */
  const shimmerX = useRef(new Animated.Value(-1)).current;
  RNuseEffect(() => {
    if (!isComplete) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, {
          toValue: 2,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.delay(600),
        Animated.timing(shimmerX, {
          toValue: -1,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isComplete]);

  const shimmerTranslate = shimmerX.interpolate({
    inputRange: [-1, 2],
    outputRange: [-200, 400],
  });

  return (
    <View>
      {/* Track */}
      <View
        style={[
          P.track,
          { height, backgroundColor: activeBg, borderRadius: radius },
        ]}
      >
        {/* Animated fill */}
        {pct > 0 && (
          <Animated.View
            style={[
              P.fillWrap,
              {
                width: widthAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ["0%", "100%"],
                }),
                height,
                borderRadius: radius,
                shadowColor: activeGlow,
                shadowOpacity: 0.7,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 0 },
                elevation: 6,
              },
            ]}
          >
            <LinearGradient
              colors={activeGrad}
              style={{ flex: 1, borderRadius: radius }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />

            {/* Tip glow dot */}
            <View
              style={[
                P.tipDot,
                {
                  width: height + 4,
                  height: height + 4,
                  borderRadius: (height + 4) / 2,
                  backgroundColor: activeGrad[1],
                  shadowColor: activeGlow,
                  shadowOpacity: 0.9,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 8,
                  top: -2,
                },
              ]}
            />

            {/* Shimmer sweep on complete */}
            {isComplete && (
              <Animated.View
                style={[
                  P.shimmer,
                  {
                    borderRadius: radius,
                    transform: [{ translateX: shimmerTranslate }],
                  },
                ]}
              />
            )}
          </Animated.View>
        )}
      </View>

      {/* Milestone markers */}
      {showMilestones && (
        <View style={[P.milestoneRow, { marginTop: 3 }]}>
          {[25, 50, 75].map((m) => (
            <View
              key={m}
              style={[
                P.milestoneDot,
                {
                  left: `${m}%` as any,
                  backgroundColor:
                    pct >= m ? activeGrad[0] : "rgba(255,255,255,0.15)",
                  shadowColor: pct >= m ? activeGlow : "transparent",
                  shadowOpacity: 0.8,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 0 },
                },
              ]}
            />
          ))}
        </View>
      )}

      {/* Label */}
      {showLabel && (
        <Text style={[P.label, { color: labelColor ?? activeGrad[0] }]}>
          {label ?? (isComplete ? "✅ Complete!" : `${Math.round(pct)}%`)}
        </Text>
      )}
    </View>
  );
}

/* ─── Circular / ring variant for kid profile screens ──────── */
interface RingProgressProps {
  value: number; // 0–100
  size?: number;
  stroke?: number;
  theme?: ThemeKey;
  label?: string;
  emoji?: string;
}

export function RingProgress({
  value,
  size = 80,
  stroke = 7,
  theme = "gold",
  label,
  emoji,
}: RingProgressProps) {
  const pct = Math.max(0, Math.min(100, value));
  const activeTheme = PROGRESS_THEMES[theme] ?? PROGRESS_THEMES.gold;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <View style={[RP.wrap, { width: size, height: size }]}>
      {/* Track ring */}
      <View
        style={[
          RP.trackRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: stroke,
            borderColor: activeTheme.bg,
          },
        ]}
      />

      {/* Fill arc approximation using rotation */}
      <View
        style={[
          RP.fillArc,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: stroke,
            borderColor: "transparent",
            borderTopColor: activeTheme.grad[0],
            borderRightColor: pct > 25 ? activeTheme.grad[0] : "transparent",
            borderBottomColor: pct > 50 ? activeTheme.grad[1] : "transparent",
            borderLeftColor: pct > 75 ? activeTheme.grad[1] : "transparent",
            transform: [{ rotate: "-90deg" }],
            shadowColor: activeTheme.glow,
            shadowOpacity: 0.6,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
            elevation: 6,
          },
        ]}
      />

      {/* Center content */}
      <View style={RP.center}>
        {emoji ? (
          <Text style={{ fontSize: size * 0.35 }}>{emoji}</Text>
        ) : (
          <Text
            style={[
              RP.pctText,
              { color: activeTheme.grad[0], fontSize: size * 0.22 },
            ]}
          >
            {Math.round(pct)}%
          </Text>
        )}
        {label && (
          <Text
            style={[
              RP.labelText,
              { color: "rgba(255,255,255,0.55)", fontSize: size * 0.11 },
            ]}
          >
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}

const P = StyleSheet.create({
  track: { overflow: "visible", position: "relative" },
  fillWrap: { position: "absolute", left: 0, top: 0, overflow: "hidden" },
  tipDot: {
    position: "absolute",
    right: -6,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: "rgba(255,255,255,0.25)",
    transform: [{ skewX: "-20deg" }],
  },
  milestoneRow: { position: "relative", height: 6 },
  milestoneDot: {
    position: "absolute",
    top: 1,
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: -2,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 6,
    textAlign: "right",
    letterSpacing: 0.2,
  },
});

const RP = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  trackRing: { position: "absolute" },
  fillArc: { position: "absolute" },
  center: { alignItems: "center", justifyContent: "center" },
  pctText: { fontWeight: "900", letterSpacing: -0.5 },
  labelText: { fontWeight: "700", marginTop: 1 },
});
