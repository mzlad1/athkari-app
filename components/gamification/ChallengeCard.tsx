import { View, Text, Pressable, StyleSheet } from "react-native";
import { COLORS } from "@/constants/theme";

interface ChallengeCardProps {
  nameAr: string;
  nameEn: string;
  type: "community" | "1v1";
  goal: number;
  progress: number;
  rewardStars: number;
  participantCount: number;
  status: string;
  daysLeft: number;
  isRTL: boolean;
  isJoined: boolean;
  onJoin?: () => void;
  onPress?: () => void;
}

export function ChallengeCard({
  nameAr,
  nameEn,
  type,
  goal,
  progress,
  rewardStars,
  participantCount,
  status,
  daysLeft,
  isRTL,
  isJoined,
  onJoin,
  onPress,
}: ChallengeCardProps) {
  const progressPct = Math.min((progress / goal) * 100, 100);
  const isActive = status === "active";
  const isCompleted = progress >= goal;

  return (
    <Pressable
      style={[styles.card, isCompleted && styles.cardCompleted]}
      onPress={onPress}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.typeIcon}>
            {type === "community" ? "🌍" : "⚔️"}
          </Text>
          <View>
            <Text style={styles.name}>{isRTL ? nameAr : nameEn}</Text>
            <Text style={styles.meta}>
              {isRTL
                ? `${participantCount} مشارك • ${daysLeft} أيام باقية`
                : `${participantCount} joined • ${daysLeft} days left`}
            </Text>
          </View>
        </View>
        <View style={styles.reward}>
          <Text style={styles.rewardText}>⭐ {rewardStars}</Text>
        </View>
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>
          {progress.toLocaleString()} / {goal.toLocaleString()}
        </Text>
        <Text style={styles.progressPct}>{Math.round(progressPct)}%</Text>
      </View>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${progressPct}%` },
            isCompleted && styles.progressComplete,
          ]}
        />
      </View>

      {/* Action button */}
      {isActive && !isJoined && onJoin && (
        <Pressable style={styles.joinBtn} onPress={onJoin}>
          <Text style={styles.joinText}>
            {isRTL ? "انضم الآن 🚀" : "Join Now 🚀"}
          </Text>
        </Pressable>
      )}
      {isJoined && !isCompleted && (
        <Text style={styles.joinedLabel}>
          {isRTL ? "✅ منضم" : "✅ Joined"}
        </Text>
      )}
      {isCompleted && (
        <Text style={styles.completedLabel}>
          🎉 {isRTL ? "مكتمل!" : "Completed!"}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardCompleted: {
    borderColor: COLORS.green + "40",
    backgroundColor: COLORS.green + "08",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  typeIcon: { fontSize: 28 },
  name: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  reward: {
    backgroundColor: COLORS.gold + "15",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rewardText: { fontSize: 13, fontWeight: "600", color: COLORS.gold },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressLabel: { fontSize: 12, color: COLORS.textSecondary },
  progressPct: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600" },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: {
    height: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  progressComplete: { backgroundColor: COLORS.green },
  joinBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  joinText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  joinedLabel: {
    textAlign: "center",
    color: COLORS.green,
    fontWeight: "600",
    fontSize: 14,
  },
  completedLabel: {
    textAlign: "center",
    color: COLORS.gold,
    fontWeight: "600",
    fontSize: 14,
  },
});
