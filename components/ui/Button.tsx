import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
  Animated,
} from "react-native";
import { useRef, useCallback } from "react";
import { LinearGradient } from "expo-linear-gradient";

/* ─── Variant config ───────────────────────────────────────────
   Each variant is fully specified: gradient, glow, border,
   text color, and disabled state.
   ─────────────────────────────────────────────────────────── */
type Variant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "success"
  | "warning"
  | "night"
  | "gold";
type Size = "sm" | "md" | "lg";

interface VariantConfig {
  grad?: [string, string];
  flat?: string;
  border?: string;
  textColor: string;
  glowColor: string;
  glowOpacity: number;
  hasShadow: boolean;
}

const VARIANTS: Record<Variant, VariantConfig> = {
  /* Warm amber — parent world primary */
  primary: {
    grad: ["#D97706", "#B45309"],
    textColor: "#FFFFFF",
    glowColor: "#D97706",
    glowOpacity: 0.3,
    hasShadow: true,
  },
  /* Night gold — kid world primary */
  gold: {
    grad: ["#FFC843", "#E6A800"],
    textColor: "#0F1E35",
    glowColor: "#FFC843",
    glowOpacity: 0.35,
    hasShadow: true,
  },
  /* Deep night card */
  night: {
    grad: ["#1E3554", "#162945"],
    textColor: "#F0E8D8",
    border: "rgba(255,255,255,0.09)",
    glowColor: "#000",
    glowOpacity: 0.3,
    hasShadow: true,
  },
  secondary: {
    flat: "rgba(217,119,6,0.08)",
    border: "rgba(217,119,6,0.25)",
    textColor: "#D97706",
    glowColor: "#D97706",
    glowOpacity: 0,
    hasShadow: false,
  },
  ghost: {
    flat: "transparent",
    textColor: "#D97706",
    glowColor: "transparent",
    glowOpacity: 0,
    hasShadow: false,
  },
  danger: {
    grad: ["#DC2626", "#991B1B"],
    textColor: "#FFFFFF",
    glowColor: "#DC2626",
    glowOpacity: 0.3,
    hasShadow: true,
  },
  success: {
    grad: ["#059669", "#065F46"],
    textColor: "#FFFFFF",
    glowColor: "#059669",
    glowOpacity: 0.28,
    hasShadow: true,
  },
  warning: {
    grad: ["#FF6B4A", "#E85A3C"],
    textColor: "#FFFFFF",
    glowColor: "#FF6B4A",
    glowOpacity: 0.3,
    hasShadow: true,
  },
};

const SIZES: Record<
  Size,
  { pad: ViewStyle; fontSize: number; radius: number; iconSize: number }
> = {
  sm: {
    pad: { paddingHorizontal: 16, paddingVertical: 9 },
    fontSize: 13,
    radius: 14,
    iconSize: 14,
  },
  md: {
    pad: { paddingHorizontal: 22, paddingVertical: 14 },
    fontSize: 15,
    radius: 18,
    iconSize: 16,
  },
  lg: {
    pad: { paddingHorizontal: 30, paddingVertical: 18 },
    fontSize: 17,
    radius: 22,
    iconSize: 18,
  },
};

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  iconRight?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  iconRight = false,
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const cfg = VARIANTS[variant];
  const sz = SIZES[size];
  const off = disabled || loading;

  /* Spring press scale */
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = useCallback(
    () =>
      Animated.spring(scale, {
        toValue: 0.95,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }).start(),
    [],
  );
  const onOut = useCallback(
    () =>
      Animated.spring(scale, {
        toValue: 1,
        tension: 280,
        friction: 10,
        useNativeDriver: true,
      }).start(),
    [],
  );

  /* Inner content */
  const content = loading ? (
    <ActivityIndicator color={cfg.textColor} size="small" />
  ) : (
    <View style={B.row}>
      {icon && !iconRight && (
        <Text style={[B.icon, { fontSize: sz.iconSize, color: cfg.textColor }]}>
          {icon}
        </Text>
      )}
      <Text
        style={[
          B.label,
          { color: cfg.textColor, fontSize: sz.fontSize },
          textStyle,
        ]}
      >
        {title}
      </Text>
      {icon && iconRight && (
        <Text style={[B.icon, { fontSize: sz.iconSize, color: cfg.textColor }]}>
          {icon}
        </Text>
      )}
    </View>
  );

  const baseStyle: ViewStyle = {
    borderRadius: sz.radius,
    alignSelf: fullWidth ? "stretch" : "auto",
    opacity: off ? 0.45 : 1,
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      onPressIn={onIn}
      onPressOut={onOut}
      style={[{ alignSelf: fullWidth ? "stretch" : "flex-start" }, style]}
    >
      <Animated.View
        style={[
          baseStyle,
          { transform: [{ scale }] },
          cfg.hasShadow && !off
            ? {
                shadowColor: cfg.glowColor,
                shadowOffset: { width: 0, height: 5 },
                shadowOpacity: cfg.glowOpacity,
                shadowRadius: 14,
                elevation: 8,
              }
            : undefined,
        ]}
      >
        {cfg.grad ? (
          /* Gradient button */
          <LinearGradient
            colors={cfg.grad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              B.inner,
              sz.pad,
              { borderRadius: sz.radius, overflow: "hidden" },
            ]}
          >
            {/* Top gloss */}
            <View
              style={[
                B.gloss,
                {
                  borderTopLeftRadius: sz.radius,
                  borderTopRightRadius: sz.radius,
                },
              ]}
            />
            {content}
          </LinearGradient>
        ) : (
          /* Flat button */
          <View
            style={[
              B.inner,
              sz.pad,
              {
                borderRadius: sz.radius,
                backgroundColor: cfg.flat ?? "transparent",
              },
              cfg.border
                ? { borderWidth: 1.5, borderColor: cfg.border }
                : undefined,
            ]}
          >
            {content}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const B = StyleSheet.create({
  inner: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  gloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontWeight: "900", letterSpacing: 0.2 },
  icon: { lineHeight: undefined },
});
