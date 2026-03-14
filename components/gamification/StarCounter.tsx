import { View, Text, StyleSheet } from "react-native";
import { useRef, useEffect } from "react";
import { Animated } from "react-native";
import { COLORS } from "@/constants/theme";

interface StarCounterProps {
  stars: number;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
}

export function StarCounter({
  stars,
  size = "md",
  animated = true,
}: StarCounterProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (animated && stars > 0) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [stars]);

  const sizes = {
    sm: { emoji: 14, text: 14, pad: 6, padH: 10 },
    md: { emoji: 18, text: 18, pad: 8, padH: 14 },
    lg: { emoji: 24, text: 24, pad: 12, padH: 20 },
  };

  const s = sizes[size];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingVertical: s.pad,
          paddingHorizontal: s.padH,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Text style={{ fontSize: s.emoji }}>⭐</Text>
      <Text style={[styles.text, { fontSize: s.text }]}>
        {stars.toLocaleString()}
      </Text>
    </Animated.View>
  );
}

interface LeaderboardRowProps {
  rank: number;
  name: string;
  avatar: string;
  stars: number;
  isCurrentUser: boolean;
  isRTL: boolean;
}

export function LeaderboardRow({
  rank,
  name,
  avatar,
  stars,
  isCurrentUser,
  isRTL,
}: LeaderboardRowProps) {
  const getRankEmoji = () => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `${rank}`;
  };

  return (
    <View style={[styles.row, isCurrentUser && styles.rowCurrent]}>
      <View style={styles.rowLeft}>
        <Text style={styles.rank}>{getRankEmoji()}</Text>
        <Text style={styles.avatar}>{avatar}</Text>
        <Text style={[styles.name, isCurrentUser && styles.nameCurrent]}>
          {name}
          {isCurrentUser ? (isRTL ? " (أنت)" : " (You)") : ""}
        </Text>
      </View>
      <StarCounter stars={stars} size="sm" animated={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.gold + "15",
    borderRadius: 20,
  },
  text: {
    color: COLORS.gold,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.bgCard,
    marginHorizontal: 20,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowCurrent: {
    borderColor: COLORS.primary + "60",
    backgroundColor: COLORS.primary + "08",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rank: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textSecondary,
    width: 28,
    textAlign: "center",
  },
  avatar: { fontSize: 24 },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  nameCurrent: { color: COLORS.primary },
});
