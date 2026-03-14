import { View, Text, StyleSheet, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { COLORS } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";

/* ─── Loading ─── */

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export function Loading({ message, fullScreen = true }: LoadingProps) {
  // Rotating arc animation
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <View style={styles.spinnerWrap}>
        <Animated.View
          style={[styles.spinnerRing, { transform: [{ rotate }] }]}
        />
        <Animated.Text
          style={[styles.spinnerEmoji, { transform: [{ scale: pulse }] }]}
        >
          📿
        </Animated.Text>
      </View>
      {message && <Text style={styles.loadingText}>{message}</Text>}
    </View>
  );
}

/* ─── EmptyState ─── */

interface EmptyStateProps {
  emoji?: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ emoji = "📭", title, subtitle }: EmptyStateProps) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: -8,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <View style={styles.emptyContainer}>
      <Animated.View
        style={[styles.emptyEmojiWrap, { transform: [{ translateY: float }] }]}
      >
        <LinearGradient
          colors={["#EDE9FE", "#DDD6FE"]}
          style={styles.emptyEmojiCircle}
        >
          <Text style={styles.emptyEmoji}>{emoji}</Text>
        </LinearGradient>
      </Animated.View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  // Loading
  container: { alignItems: "center", justifyContent: "center", padding: 40 },
  fullScreen: { flex: 1, backgroundColor: "#FFF7ED" },

  spinnerWrap: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  spinnerRing: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "transparent",
    borderTopColor: "#7C3AED",
    borderRightColor: "#C4B5FD",
  },
  spinnerEmoji: { fontSize: 32 },
  loadingText: {
    color: "#78716C",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },

  // EmptyState
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyEmojiWrap: { marginBottom: 16 },
  emptyEmojiCircle: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1C1917",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#A8A29E",
    textAlign: "center",
    lineHeight: 22,
  },
});
