import { View, StyleSheet, ViewStyle } from "react-native";
import { COLORS, SHADOWS } from "@/constants/theme";

interface CardProps {
  children: React.ReactNode;
  variant?: "default" | "highlighted" | "success" | "warning";
  style?: ViewStyle;
}

export function Card({ children, variant = "default", style }: CardProps) {
  return <View style={[styles.card, styles[variant], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  default: {},
  highlighted: { borderColor: COLORS.primary + "60" },
  success: { borderColor: COLORS.green + "60" },
  warning: { borderColor: COLORS.gold + "60" },
} as any);
