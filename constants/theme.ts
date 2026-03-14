export const COLORS = {
  primary: "#7C3AED",
  primaryLight: "#A78BFA",
  primaryDark: "#5B21B6",
  gold: "#FBBF24",
  goldDark: "#D97706",
  green: "#10B981",
  greenDark: "#059669",
  red: "#EF4444",
  bg: "#F8FAFF",
  bgCard: "#FFFFFF",
  bgModal: "#FFFFFF",
  text: "#1F2937",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  border: "#E5E7EB",
  headerBg: "#EDE9FE",
};

export const FONTS = {
  arabic: "Amiri",
  arabicBold: "Amiri-Bold",
  heading: "System",
  body: "System",
};

export const GRADIENTS = {
  morning: ["#F59E0B", "#FBBF24", "#FCD34D"],
  evening: ["#7C3AED", "#8B5CF6", "#A78BFA"],
  sleep: ["#1E3A5F", "#2D4A7A", "#3B5998"],
  food: ["#059669", "#10B981", "#34D399"],
  mosque: ["#0891B2", "#22D3EE", "#67E8F9"],
  waking: ["#EA580C", "#F97316", "#FB923C"],
  wudu: ["#2563EB", "#3B82F6", "#60A5FA"],
  home: ["#B45309", "#D97706", "#F59E0B"],
  general: ["#DB2777", "#EC4899", "#F472B6"],
};

export const SHADOWS = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
};

/**
 * Resolve a gradient value from the DB.
 * Supports preset keys ("morning", "evening", etc.) and custom strings
 * ("custom:#hex1,#hex2,#hex3").
 */
export function resolveGradient(value?: string | null): string[] {
  if (!value) return GRADIENTS.general;
  if (value.startsWith("custom:")) {
    const colors = value.replace("custom:", "").split(",").map(c => c.trim());
    if (colors.length >= 2) return colors;
    return GRADIENTS.general;
  }
  return GRADIENTS[value as keyof typeof GRADIENTS] || GRADIENTS.general;
}
