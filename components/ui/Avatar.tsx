import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  ViewStyle,
} from "react-native";
import { useRef, useCallback } from "react";
import { LinearGradient } from "expo-linear-gradient";

/* ─── Brand tokens ─────────────────────────────────────────────
   Avatar is used in both kid (night sky) and parent (warm dawn)
   contexts. We default to night-sky and accept color overrides.
   ─────────────────────────────────────────────────────────── */
const DEFAULTS = {
  /* Night-sky palette */
  cardBg: "#1E3554",
  surface: "#162945",
  borderIdle: "rgba(255,255,255,0.07)",
  borderSel: "rgba(255,200,67,0.55)",
  glowSel: "#FFC843",
  checkBg: "#FFC843",
  checkColor: "#0F1E35",
};

/* ─── Single Avatar ─────────────────────────────────────────── */
interface AvatarProps {
  emoji: string;
  size?: number;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  /* Optional theme overrides for parent-world usage */
  selBorderColor?: string;
  selGlowColor?: string;
  selBgColor?: string;
  idleBgColor?: string;
}

export const AVATAR_LIST = [
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

export function Avatar({
  emoji,
  size = 52,
  selected = false,
  onPress,
  style,
  selBorderColor = DEFAULTS.borderSel,
  selGlowColor = DEFAULTS.glowSel,
  selBgColor = "rgba(255,200,67,0.12)",
  idleBgColor = DEFAULTS.cardBg,
}: AvatarProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.88,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, []);
  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 260,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, []);

  const radius = size * 0.32;

  const content = (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View
        style={[
          A.base,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: selected ? selBgColor : idleBgColor,
            borderColor: selected ? selBorderColor : DEFAULTS.borderIdle,
            shadowColor: selected ? selGlowColor : "transparent",
            shadowOpacity: selected ? 0.55 : 0,
            shadowRadius: selected ? 12 : 0,
            shadowOffset: { width: 0, height: 0 },
            elevation: selected ? 6 : 0,
          },
          style,
        ]}
      >
        {/* Subtle gradient fill when selected */}
        {selected && (
          <LinearGradient
            colors={[selBgColor, "rgba(255,255,255,0.02)"]}
            style={StyleSheet.absoluteFillObject}
          />
        )}

        {/* Top shine */}
        {selected && <View style={[A.topShine, { borderRadius: radius }]} />}

        <Text style={[A.emoji, { fontSize: size * 0.5 }]}>{emoji}</Text>

        {/* Checkmark dot */}
        {selected && (
          <View
            style={[
              A.checkDot,
              {
                backgroundColor: selGlowColor,
                top: size * 0.06,
                right: size * 0.06,
                width: size * 0.24,
                height: size * 0.24,
                borderRadius: size * 0.12,
              },
            ]}
          >
            <Text style={[A.checkMark, { fontSize: size * 0.12 }]}>✓</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={6}
    >
      {content}
    </Pressable>
  );
}

/* ─── Avatar Grid ───────────────────────────────────────────── */
interface AvatarGridProps {
  avatars?: string[];
  selected: string;
  onSelect: (avatar: string) => void;
  columns?: number;
  /* Theme pass-through */
  selBorderColor?: string;
  selGlowColor?: string;
  selBgColor?: string;
  idleBgColor?: string;
}

export function AvatarGrid({
  avatars = AVATAR_LIST,
  selected,
  onSelect,
  selBorderColor,
  selGlowColor,
  selBgColor,
  idleBgColor,
}: AvatarGridProps) {
  return (
    <View style={A.grid}>
      {avatars.map((a) => (
        <Avatar
          key={a}
          emoji={a}
          size={54}
          selected={selected === a}
          onPress={() => onSelect(a)}
          selBorderColor={selBorderColor}
          selGlowColor={selGlowColor}
          selBgColor={selBgColor}
          idleBgColor={idleBgColor}
        />
      ))}
    </View>
  );
}

const A = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    overflow: "hidden",
    position: "relative",
  },
  topShine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  emoji: { textAlign: "center", lineHeight: undefined },
  checkDot: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.6)",
  },
  checkMark: { color: "#0F1E35", fontWeight: "900" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
});
