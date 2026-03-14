import { View, Text, StyleSheet, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "@/constants/theme";

interface StreakDisplayProps {
  streak: number;
  isRTL: boolean;
  showFlame?: boolean;
}

type StreakTier = {
  colors: [string, string];
  glowColor: string;
  ringColor: string;
  flame: string;
  title: (isRTL: boolean) => string;
  label: string;
};

const getTier = (streak: number): StreakTier => {
  if (streak >= 30)
    return {
      colors: ["#FF4500", "#FF6B35"],
      glowColor: "#FF4500",
      ringColor: "#FF4500",
      flame: "🔥",
      title: (r) => (r ? "🔥 أسطوري!" : "🔥 Legendary!"),
      label: "legendary",
    };
  if (streak >= 14)
    return {
      colors: ["#F59E0B", "#FBBF24"],
      glowColor: "#F59E0B",
      ringColor: "#F59E0B",
      flame: "⚡",
      title: (r) => (r ? "⚡ رائع!" : "⚡ Amazing!"),
      label: "amazing",
    };
  if (streak >= 7)
    return {
      colors: ["#F97316", "#FB923C"],
      glowColor: "#F97316",
      ringColor: "#F97316",
      flame: "💪",
      title: (r) => (r ? "💪 ممتاز!" : "💪 Great!"),
      label: "great",
    };
  if (streak >= 3)
    return {
      colors: ["#7C3AED", "#9333EA"],
      glowColor: "#7C3AED",
      ringColor: "#7C3AED",
      flame: "✨",
      title: (r) => (r ? "✨ جيد!" : "✨ Good!"),
      label: "good",
    };
  return {
    colors: ["#10B981", "#059669"],
    glowColor: "#10B981",
    ringColor: "#10B981",
    flame: "🌱",
    title: (r) => (r ? "🌱 ابدأ!" : "🌱 Start!"),
    label: "start",
  };
};

const MILESTONES = [3, 7, 14, 30];
const MILESTONE_EMOJIS = ["✨", "💪", "⚡", "🔥"];

export function StreakDisplay({
  streak,
  isRTL,
  showFlame = true,
}: StreakDisplayProps) {
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flameAnim = useRef(new Animated.Value(0)).current;

  const tier = getTier(streak);

  useEffect(() => {
    if (streak > 0) {
      // Bounce on streak change
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1.18,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(bounceAnim, {
          toValue: 1,
          friction: 3,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [streak]);

  // Persistent glow pulse for active streaks
  useEffect(() => {
    if (streak >= 3) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.06,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
    // Flame float
    Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, {
          toValue: -5,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(flameAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  // Next milestone progress
  const nextMilestone = MILESTONES.find((m) => m > streak);
  const prevMilestone = [...MILESTONES].reverse().find((m) => m <= streak) ?? 0;
  const segmentPct = nextMilestone
    ? Math.round(
        ((streak - prevMilestone) / (nextMilestone - prevMilestone)) * 100,
      )
    : 100;

  return (
    <View style={styles.container}>
      {/* Outer glow ring + circle */}
      <Animated.View
        style={{ transform: [{ scale: streak >= 3 ? pulseAnim : bounceAnim }] }}
      >
        <View style={[styles.glowRing, { shadowColor: tier.glowColor }]}>
          <LinearGradient
            colors={tier.colors}
            style={styles.circle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Flame / icon floating above */}
            {showFlame && (
              <Animated.Text
                style={[
                  styles.flameEmoji,
                  { transform: [{ translateY: flameAnim }] },
                ]}
              >
                {tier.flame}
              </Animated.Text>
            )}
            <Text style={styles.number}>{streak}</Text>
            <Text style={styles.dayLabel}>{isRTL ? "يوم" : "days"}</Text>
          </LinearGradient>
        </View>
      </Animated.View>

      {/* Title */}
      <Text style={[styles.title, { color: tier.glowColor }]}>
        {tier.title(isRTL)}
      </Text>

      {/* Next milestone mini progress */}
      {nextMilestone && (
        <View style={styles.nextRow}>
          <Text style={styles.nextLabel}>
            {isRTL
              ? `${nextMilestone - streak} أيام للمستوى التالي`
              : `${nextMilestone - streak} days to next level`}
          </Text>
          <View style={styles.miniTrack}>
            <LinearGradient
              colors={tier.colors}
              style={[styles.miniFill, { width: `${segmentPct}%` }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
        </View>
      )}

      {/* Milestone dots */}
      <View style={styles.milestones}>
        {MILESTONES.map((milestone, i) => {
          const reached = streak >= milestone;
          return (
            <View key={milestone} style={styles.milestoneWrap}>
              {reached ? (
                <LinearGradient
                  colors={getTier(milestone).colors}
                  style={styles.milestoneReached}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.milestoneEmoji}>
                    {MILESTONE_EMOJIS[i]}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={styles.milestonePending}>
                  <Text style={styles.milestonePendingNum}>{milestone}</Text>
                </View>
              )}
              <Text
                style={[
                  styles.milestoneDay,
                  reached && { color: getTier(milestone).glowColor },
                ]}
              >
                {isRTL ? `${milestone}` : `${milestone}d`}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 20 },

  // Circle
  glowRing: {
    borderRadius: 60,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
    marginBottom: 12,
  },
  circle: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  flameEmoji: {
    fontSize: 24,
    position: "absolute",
    top: -14,
  },
  number: {
    fontSize: 36,
    fontWeight: "900",
    color: "#fff",
    lineHeight: 40,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(255,255,255,0.8)",
    marginTop: -2,
  },

  // Title
  title: {
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 10,
  },

  // Next milestone mini bar
  nextRow: { alignItems: "center", gap: 6, marginBottom: 14, width: 200 },
  nextLabel: { fontSize: 11, fontWeight: "700", color: "#A8A29E" },
  miniTrack: {
    width: "100%",
    height: 6,
    backgroundColor: "#EDE9FE",
    borderRadius: 50,
    overflow: "hidden",
  },
  miniFill: { height: "100%", borderRadius: 50 },

  // Milestones
  milestones: { flexDirection: "row", gap: 14 },
  milestoneWrap: { alignItems: "center", gap: 5 },
  milestoneReached: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  milestoneEmoji: { fontSize: 20 },
  milestonePending: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  milestonePendingNum: { fontSize: 14, fontWeight: "900", color: "#D1D5DB" },
  milestoneDay: { fontSize: 10, fontWeight: "800", color: "#A8A29E" },
});
