import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLang } from "@/contexts/LangContext";
import { T } from "@/constants/translations";
import { soundService } from "@/services/sounds";

const BG = "#06091E";
const ACTIVE = "#00E5FF";
const INACTIVE = "rgba(255,255,255,0.4)";
const TAB_BAR_BG = "#0B0F2E";

export default function TabsLayout() {
  const { lang } = useLang();
  const t = T[lang];

  return (
    <Tabs
      screenListeners={{
        tabPress: () => soundService.play("tab_press"),
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: TAB_BAR_BG,
          borderTopColor: "rgba(0,229,255,0.12)",
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: "Amiri",
          fontSize: 11,
        },
        sceneStyle: { backgroundColor: BG },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t.home,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="challenges"
        options={{
          title: t.challenges,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="badges"
        options={{
          title: t.badges,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ribbon" size={size} color={color} />
          ),
        }}
      />
      {/* Hidden from tab bar */}
      <Tabs.Screen name="[categoryId]" options={{ href: null }} />
    </Tabs>
  );
}
