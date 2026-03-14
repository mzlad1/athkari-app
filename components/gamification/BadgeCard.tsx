import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { useRef, useCallback } from "react";
import { LinearGradient } from "expo-linear-gradient";

interface BadgeCardProps {
  icon: string;
  nameAr: string;
  nameEn: string;
  isEarned: boolean;
  progress: number; // 0-100
  unlockedAt?: string | null;
  isRTL: boolean;
  onPress?: () => void;
}

export function BadgeCard({
  icon,
  nameAr,
  nameEn,
  isEarned,
  progress,
  unlockedAt,
  isRTL,
  onPress,
}: BadgeCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  }, []);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.cardWrap,
        { transform: [{ scale }] },
        isEarned ? styles.cardEarnedShadow : styles.cardLockedShadow,
      ]}
    >
      <Pressable
        style={[styles.card, isEarned && styles.cardEarned]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        {/* Decorative watermark */}
        <Text style={styles.watermark}>{isEarned ? "✨" : "🔒"}</Text>

        {/* Icon circle */}
        <View
          style={[
            styles.iconCircle,
            isEarned ? styles.iconCircleEarned : styles.iconCircleLocked,
          ]}
        >
          <Text style={[styles.icon, !isEarned && styles.iconLocked]}>
            {icon}
          </Text>
        </View>

        {/* Badge name */}
        <Text
          style={[styles.name, !isEarned && styles.nameLocked]}
          numberOfLines={2}
        >
          {isRTL ? nameAr : nameEn}
        </Text>

        {isEarned ? (
          <View style={styles.earnedPill}>
            <LinearGradient
              colors={["#F59E0B", "#FBBF24"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.earnedPillGradient}
            >
              <Text style={styles.earnedText}>
                ⭐ {isRTL ? "مكتسب" : "Earned"}
              </Text>
            </LinearGradient>
          </View>
        ) : (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <LinearGradient
                colors={["#7C3AED", "#A78BFA"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressFill,
                  { width: `${Math.max(progress, 2)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{Math.round(progress)}%</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    width: "47%",
    marginBottom: 14,
  },
  cardEarnedShadow: {
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  cardLockedShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    alignItems: "center",
    overflow: "hidden",
  },
  cardEarned: {
    backgroundColor: "#FFFBEB",
  },
  watermark: {
    position: "absolute",
    top: -10,
    right: -10,
    fontSize: 60,
    opacity: 0.07,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  iconCircleEarned: {
    backgroundColor: "rgba(245,158,11,0.12)",
  },
  iconCircleLocked: {
    backgroundColor: "rgba(120,113,108,0.08)",
  },
  icon: {
    fontSize: 34,
  },
  iconLocked: {
    opacity: 0.4,
  },
  name: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1C1917",
    textAlign: "center",
    marginBottom: 10,
  },
  nameLocked: {
    color: "#78716C",
  },
  earnedPill: {
    borderRadius: 50,
    overflow: "hidden",
  },
  earnedPillGradient: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 50,
  },
  earnedText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  progressContainer: {
    width: "100%",
    alignItems: "center",
  },
  progressBar: {
    width: "100%",
    height: 8,
    backgroundColor: "rgba(120,113,108,0.10)",
    borderRadius: 50,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: {
    height: 8,
    borderRadius: 50,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#7C3AED",
  },
});
