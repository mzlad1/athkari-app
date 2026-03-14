import { Tabs } from "expo-router";
import { COLORS } from "@/constants/theme";
import { Text, View, StyleSheet } from "react-native";
import { useLang } from "@/contexts/LangContext";
import { T } from "@/constants/translations";
import { LinearGradient } from "expo-linear-gradient";

const TAB_CONFIGS = [
  {
    name: "kids",
    emoji: "👶",
    gradColors: ["#F97316", "#FB923C"] as [string, string],
  },
  {
    name: "monitor",
    emoji: "📊",
    gradColors: ["#10B981", "#059669"] as [string, string],
  },
  {
    name: "friends",
    emoji: "👫",
    gradColors: ["#10B981", "#047857"] as [string, string],
  },
  {
    name: "plans",
    emoji: "💎",
    gradColors: ["#7C3AED", "#9333EA"] as [string, string],
  },
  {
    name: "settings",
    emoji: "⚙️",
    gradColors: ["#7C3AED", "#C026D3"] as [string, string],
  },
];

function TabIcon({
  emoji,
  focused,
  gradColors,
}: {
  emoji: string;
  focused: boolean;
  gradColors: [string, string];
}) {
  if (focused) {
    return (
      <View style={tabStyles.iconWrap}>
        <LinearGradient
          colors={gradColors}
          style={tabStyles.iconActivePill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={tabStyles.iconEmoji}>{emoji}</Text>
        </LinearGradient>
      </View>
    );
  }
  return (
    <View style={tabStyles.iconWrap}>
      <View style={tabStyles.iconInactive}>
        <Text style={[tabStyles.iconEmoji, { opacity: 0.55 }]}>{emoji}</Text>
      </View>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 36,
  },
  iconActivePill: {
    width: 44,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F97316",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  iconInactive: {
    width: 44,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  iconEmoji: { fontSize: 20 },
});

export default function ParentDashboardLayout() {
  const { lang } = useLang();
  const isRTL = lang === "ar";
  const t = T[lang];

  const TAB_LABELS = {
    kids: t.myKids,
    monitor: isRTL ? "المراقبة" : "Monitor",
    friends: isRTL ? "الأصدقاء" : "Friends",
    plans: isRTL ? "الاشتراك" : "Plans",
    settings: isRTL ? "الإعدادات" : "Settings",
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#FEF3C7",
          borderTopWidth: 2,
          height: 86,
          paddingBottom: 18,
          paddingTop: 6,
          shadowColor: "#7C3AED",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          elevation: 16,
        },
        tabBarActiveTintColor: "#7C3AED",
        tabBarInactiveTintColor: "#A8A29E",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "800", marginTop: 0 },
      }}
    >
      {TAB_CONFIGS.map(({ name, emoji, gradColors }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: TAB_LABELS[name as keyof typeof TAB_LABELS],
            tabBarIcon: ({ focused }) => (
              <TabIcon
                emoji={emoji}
                focused={focused}
                gradColors={gradColors}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
