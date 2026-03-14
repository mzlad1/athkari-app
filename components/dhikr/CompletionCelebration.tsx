import { View, Text, StyleSheet, Pressable } from "react-native";
import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { COLORS } from "@/constants/theme";

interface CompletionCelebrationProps {
  totalStars: number;
  message: string;
  onDismiss: () => void;
  isRTL: boolean;
}

export function CompletionCelebration({
  totalStars,
  message,
  onDismiss,
  isRTL,
}: CompletionCelebrationProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const starsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(starsAnim, {
        toValue: 1,
        tension: 40,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const emojis = ["🎉", "⭐", "🌟", "✨", "🏆", "💫"];

  return (
    <Animated.View style={[styles.container, { opacity: opacityAnim }]}>
      {/* Floating emojis */}
      <View style={styles.emojiRow}>
        {emojis.map((e, i) => (
          <Animated.Text
            key={i}
            style={[
              styles.floatingEmoji,
              {
                transform: [
                  {
                    scale: scaleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1 + (i % 3) * 0.1],
                    }),
                  },
                  {
                    translateY: scaleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, -10 * (i % 4)],
                    }),
                  },
                ],
              },
            ]}
          >
            {e}
          </Animated.Text>
        ))}
      </View>

      {/* Main trophy */}
      <Animated.Text
        style={[styles.trophy, { transform: [{ scale: scaleAnim }] }]}
      >
        🏆
      </Animated.Text>

      {/* Message */}
      <Animated.Text
        style={[styles.title, { transform: [{ scale: scaleAnim }] }]}
      >
        {message}
      </Animated.Text>

      {/* Stars earned */}
      <Animated.View
        style={[
          styles.starsCard,
          {
            transform: [{ scale: starsAnim }],
            opacity: starsAnim,
          },
        ]}
      >
        <Text style={styles.starsLabel}>
          {isRTL ? "نجوم مكتسبة" : "Stars Earned"}
        </Text>
        <Text style={styles.starsCount}>⭐ {totalStars}</Text>
      </Animated.View>

      {/* Dismiss button */}
      <Pressable style={styles.dismissBtn} onPress={onDismiss}>
        <Text style={styles.dismissText}>
          {isRTL ? "متابعة 🚀" : "Continue 🚀"}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emojiRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  floatingEmoji: {
    fontSize: 32,
  },
  trophy: {
    fontSize: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.gold,
    textAlign: "center",
    marginBottom: 20,
  },
  starsCard: {
    backgroundColor: COLORS.gold + "15",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.gold + "30",
    marginBottom: 32,
  },
  starsLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  starsCount: {
    color: COLORS.gold,
    fontSize: 28,
    fontWeight: "800",
  },
  dismissBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
  },
  dismissText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});
