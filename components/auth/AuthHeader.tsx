import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "@/constants/theme";

interface AuthHeaderProps {
  emoji: string;
  title: string;
  subtitle?: string;
  isRTL?: boolean;
}

export function AuthHeader({ emoji, title, subtitle, isRTL }: AuthHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.title, isRTL && styles.rtl]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, isRTL && styles.rtl]}>{subtitle}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", marginBottom: 28 },
  emoji: { fontSize: 56, marginBottom: 12 },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  rtl: { textAlign: "right" } as any,
});
