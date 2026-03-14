import { View, Text, StyleSheet, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { COLORS } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";

interface DhikrProgressProps {
  current: number;
  total: number;
  isRTL: boolean;
}

export function DhikrProgress({ current, total, isRTL }: DhikrProgressProps) {
  const progress = total > 0 ? Math.round((current / total) * 100) : 0;
  const isComplete = current >= total && total > 0;

  // Animated progress bar width
  const widthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const animatedWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  // Only render dots if total is small enough to be meaningful
  const showDots = total > 0 && total <= 12;

  const barColors: [string, string] = isComplete
    ? ["#10B981", "#059669"]
    : ["#7C3AED", "#A78BFA"];

  return (
    <View style={styles.container}>
      {/* Label row */}
      <View style={styles.row}>
        <Text style={[styles.label, isRTL && { textAlign: "right" }]}>
          {isRTL ? "📿 التقدم" : "📿 Progress"}
        </Text>
        <View
          style={[styles.countPill, isComplete && styles.countPillComplete]}
        >
          <Text
            style={[styles.countText, isComplete && styles.countTextComplete]}
          >
            {isComplete ? `✅ ${current}/${total}` : `${current}/${total}`}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFillWrap, { width: animatedWidth }]}>
          <LinearGradient
            colors={barColors}
            style={styles.barFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </Animated.View>
      </View>

      {/* Dots row — only shown when total ≤ 12 */}
      {showDots && (
        <View style={styles.dotsRow}>
          {Array.from({ length: total }).map((_, i) => {
            const filled = i < current;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  filled &&
                    (isComplete ? styles.dotComplete : styles.dotFilled),
                ]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, marginBottom: 16 },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    color: "#78716C",
  },

  countPill: {
    backgroundColor: "#EDE9FE",
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  countPillComplete: { backgroundColor: "#ECFDF5" },
  countText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#7C3AED",
  },
  countTextComplete: { color: "#059669" },

  // Bar
  barTrack: {
    height: 10,
    backgroundColor: "#EDE9FE",
    borderRadius: 50,
    overflow: "hidden",
    marginBottom: 12,
  },
  barFillWrap: { height: "100%", borderRadius: 50, overflow: "hidden" },
  barFill: { flex: 1, borderRadius: 50 },

  // Dots
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EDE9FE",
  },
  dotFilled: { backgroundColor: "#7C3AED" },
  dotComplete: { backgroundColor: "#10B981" },
});
