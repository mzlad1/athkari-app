import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LangProvider } from "@/contexts/LangContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAppConfig } from "@/hooks/useAppConfig";
import { kidProgressService } from "@/services/kid-progress";
import { levelsService } from "@/services/levels";
import { AppGate } from "@/components/AppGate";
import { SplashScreen } from "@/components/SplashScreen";

// Error boundary to catch crashes and show them on screen
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errStyles.container}>
          <Text style={errStyles.title}>App Crash Caught!</Text>
          <ScrollView style={errStyles.scroll}>
            <Text style={errStyles.error}>
              {this.state.error?.message || "Unknown error"}
            </Text>
            <Text style={errStyles.stack}>
              {this.state.error?.stack || "No stack trace"}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const errStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a0000",
    padding: 20,
    paddingTop: 60,
  },
  title: { color: "#ff4444", fontSize: 22, fontWeight: "bold", marginBottom: 16 },
  scroll: { flex: 1 },
  error: { color: "#ff8888", fontSize: 16, marginBottom: 12 },
  stack: { color: "#ff666688", fontSize: 11, fontFamily: "monospace" },
});

function RootNavigator() {
  const { session, loading, family, kids, activeKid, role } = useAuth();
  const segments = useSegments();
  const { config, loading: configLoading } = useAppConfig();
  const [showSplash, setShowSplash] = useState(true);
  usePushNotifications();

  useEffect(() => {
    levelsService.fetchLevels().catch(() => {});
  }, []);

  useEffect(() => {
    if (activeKid?.id) {
      kidProgressService.updateLastActive(activeKid.id).catch(() => {});
    }
  }, [activeKid?.id]);

  // Auth-based routing guard
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inTabsGroup = segments[0] === "(tabs)";
    const inParentDash = segments[0] === "(parent-dashboard)";
    const isOnboarding =
      (segments as string[]).length === 0 || segments[0] === "index";

    if (!session && !activeKid) {
      // Not signed in and no QR-kid session — only onboarding & auth screens allowed
      if (!inAuthGroup && !isOnboarding) {
        router.replace("/");
      }
    } else if (!session && activeKid && role === "kid") {
      // QR-only kid session (no Supabase session) — allow tabs
      if (inAuthGroup || isOnboarding) {
        router.replace("/(tabs)/home");
      }
    } else if (session && family && kids.length > 0) {
      const currentRoute = (segments as string[]).join("/");

      // Kid role without selected profile — redirect to kid-login
      if (role === "kid" && !activeKid) {
        if (!currentRoute.includes("kid-login")) {
          router.replace("/(auth)/kid-login");
        }
      } else if (inAuthGroup && currentRoute.includes("kid-login")) {
        // Stay — kid is still picking profile / entering PIN
      } else if (inAuthGroup && currentRoute.includes("kid-setup")) {
        // Stay — kid setup in progress
      } else if (inAuthGroup && currentRoute.includes("add-kid")) {
        // Stay on add-kid — parent is adding another kid
      } else if (inAuthGroup && currentRoute.includes("referral")) {
        // Stay — new kid referral screen
      } else if (inAuthGroup || isOnboarding) {
        if (role === "parent" && activeKid) {
          router.replace("/(parent-dashboard)/kids");
        } else if (role === "kid" && activeKid) {
          router.replace("/(tabs)/home");
        } else if (role === "parent" && !activeKid && kids.length > 0) {
          router.replace("/(parent-dashboard)/kids");
        }
      }
    } else if (session && family && kids.length === 0) {
      // Signed in but no kids yet — redirect unless already on add-kid or plans
      const currentRoute = (segments as string[]).join("/");
      if (
        inTabsGroup ||
        isOnboarding ||
        (inAuthGroup &&
          !currentRoute.includes("add-kid") &&
          !currentRoute.includes("plans"))
      ) {
        router.replace("/(auth)/add-kid");
      }
    }
  }, [session, loading, family, kids, segments, role, activeKid]);

  return (
    <>
      <StatusBar style="light" />
      <AppGate config={config} loading={configLoading}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#0F0D1A" },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(parent-dashboard)" />
          <Stack.Screen
            name="dhikr/[categoryId]"
            options={{ presentation: "modal" }}
          />
          <Stack.Screen
            name="notifications"
            options={{ presentation: "modal" }}
          />
          <Stack.Screen name="bedtime" options={{ presentation: "modal" }} />
          <Stack.Screen name="add-friend" options={{ presentation: "modal" }} />
          <Stack.Screen name="settings" options={{ presentation: "modal" }} />
        </Stack>
      </AppGate>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <LangProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </LangProvider>
    </ErrorBoundary>
  );
}
