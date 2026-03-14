import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { useRef, useEffect } from "react";
import { COLORS } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";

interface DhikrCardProps {
  textAr: string;
  meaningAr?: string;
  meaningEn?: string;
  repetitionCount: number;
  currentCount: number;
  points: number;
  isRTL: boolean;
  onTap: () => void;
  isCompleted: boolean;
}

export function DhikrCard({
  textAr,
  meaningAr,
  meaningEn,
  repetitionCount,
  currentCount,
  points,
  isRTL,
  onTap,
  isCompleted,
}: DhikrCardProps) {
  const remaining = repetitionCount - currentCount;
  const pct = Math.min((currentCount / repetitionCount) * 100, 100);

  // Tap bounce
  const scaleAnim = useRef(new Animated.Value(1)).current;
  // Completion celebration pop
  const celebAnim = useRef(new Animated.Value(1)).current;

  const prevCompleted = useRef(isCompleted);
  useEffect(() => {
    if (!prevCompleted.current && isCompleted) {
      Animated.sequence([
        Animated.timing(celebAnim, {
          toValue: 1.04,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(celebAnim, {
          toValue: 1,
          friction: 3,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevCompleted.current = isCompleted;
  }, [isCompleted]);

  const handlePressIn = () => {
    if (isCompleted) return;
    Animated.spring(scaleAnim, {
      toValue: 0.965,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[{ transform: [{ scale: isCompleted ? celebAnim : scaleAnim }] }]}
    >
      <Pressable
        onPress={onTap}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isCompleted}
        style={{ marginHorizontal: 20 }}
      >
        {isCompleted ? (
          // ── Completed state: green gradient card ──
          <LinearGradient
            colors={["#10B981", "#059669"]}
            style={styles.card}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.completedWatermark}>✅</Text>
            <Text style={[styles.arabicText, { color: "#fff" }]}>{textAr}</Text>
            {(meaningAr || meaningEn) && (
              <Text
                style={[styles.meaning, { color: "rgba(255,255,255,0.8)" }]}
              >
                {isRTL ? meaningAr : meaningEn || meaningAr}
              </Text>
            )}
            <View style={styles.completedRow}>
              <View style={styles.completedBadge}>
                <Text style={styles.completedBadgeText}>
                  ✅ {isRTL ? "مكتمل!" : "Done!"}
                </Text>
              </View>
              <View style={styles.pointsBadge}>
                <Text style={styles.pointsBadgeText}>⭐ {points}</Text>
              </View>
            </View>
          </LinearGradient>
        ) : (
          // ── Active state: white card ──
          <View style={styles.card}>
            {/* Arabic text */}
            <Text style={styles.arabicText}>{textAr}</Text>

            {/* Meaning */}
            {(meaningAr || meaningEn) && (
              <Text style={styles.meaning}>
                {isRTL ? meaningAr : meaningEn || meaningAr}
              </Text>
            )}

            {/* Counter row */}
            <View style={styles.counterRow}>
              <LinearGradient
                colors={["#7C3AED", "#9333EA"]}
                style={styles.counterPill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.counterText}>
                  {currentCount}/{repetitionCount}
                </Text>
              </LinearGradient>

              {remaining > 0 && (
                <View style={styles.remainingPill}>
                  <Text style={styles.remainingText}>
                    {isRTL ? `باقي ${remaining}` : `${remaining} left`}
                  </Text>
                </View>
              )}

              <View style={styles.starPill}>
                <Text style={styles.starText}>⭐ {points}</Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={["#7C3AED", "#A78BFA"]}
                style={[styles.progressFill, { width: `${pct}%` }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </View>

            {/* Tap hint */}
            <Text style={styles.tapHint}>
              {isRTL ? "اضغط للعد 👆" : "Tap to count 👆"}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    padding: 24,
    backgroundColor: "#fff",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    overflow: "hidden",
    position: "relative",
  },

  // Completed
  completedWatermark: {
    position: "absolute",
    fontSize: 110,
    opacity: 0.08,
    right: -10,
    top: -10,
  },
  completedRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 14,
  },
  completedBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  completedBadgeText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  pointsBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pointsBadgeText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  // Text
  arabicText: {
    fontSize: 24,
    color: "#1C1917",
    textAlign: "center",
    lineHeight: 44,
    fontWeight: "700",
    marginBottom: 10,
  },
  meaning: {
    fontSize: 14,
    fontWeight: "600",
    color: "#78716C",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },

  // Counter row
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 14,
  },
  counterPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 50,
  },
  counterText: { color: "#fff", fontSize: 15, fontWeight: "900" },

  remainingPill: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 50,
  },
  remainingText: { color: "#92400E", fontSize: 13, fontWeight: "800" },

  starPill: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 50,
  },
  starText: { color: "#B45309", fontSize: 13, fontWeight: "800" },

  // Progress
  progressTrack: {
    height: 10,
    backgroundColor: "#EDE9FE",
    borderRadius: 50,
    overflow: "hidden",
    marginBottom: 10,
  },
  progressFill: { height: "100%", borderRadius: 50 },

  tapHint: {
    textAlign: "center",
    color: "#A8A29E",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
});
