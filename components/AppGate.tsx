import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Linking,
  Platform,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Constants from "expo-constants";
import type { AppConfig } from "@/hooks/useAppConfig";

interface AppGateProps {
  config: AppConfig;
  loading: boolean;
  children: React.ReactNode;
}

/** Compare semver strings: returns -1 if a < b, 0 if equal, 1 if a > b */
function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

function getAppVersion(): string {
  return (
    Constants.expoConfig?.version ??
    Constants.manifest2?.runtimeVersion ?? // Expo SDK 46+
    "1.0.0"
  );
}

function openStore() {
  const url =
    Platform.OS === "ios"
      ? "https://apps.apple.com/app/athkari/id0000000000" // Replace with real App Store ID
      : "https://play.google.com/store/apps/details?id=com.athkari.app";
  Linking.openURL(url).catch(() => {});
}

/**
 * AppGate always renders children (so Expo Router's Stack mounts immediately),
 * then overlays a blocking screen on top if maintenance or force-update is active.
 */
export function AppGate({ config, loading, children }: AppGateProps) {
  const showMaintenance = !loading && config.maintenance_mode;

  const currentVersion = getAppVersion();
  const needsUpdate =
    !loading && compareSemver(currentVersion, config.min_app_version) < 0;
  const showForceUpdate = needsUpdate && config.force_update;

  return (
    <View style={{ flex: 1 }}>
      {/* Always render children so the navigator mounts */}
      {children}

      {/* Overlay: Maintenance Mode */}
      {showMaintenance && (
        <LinearGradient
          colors={["#06091E", "#0D1033", "#1A0A3A"]}
          style={styles.overlay}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.center}>
            <Text style={styles.bigEmoji}>🔧</Text>
            <Text style={styles.mainTitle}>Under Maintenance</Text>
            <Text style={styles.mainTitleAr}>التطبيق تحت الصيانة</Text>
            {!!config.maintenance_msg && (
              <View style={styles.msgBox}>
                <Text style={styles.msgText}>{config.maintenance_msg}</Text>
              </View>
            )}
            <Text style={styles.hint}>
              We'll be back soon! Please check again later.
            </Text>
            <Text style={styles.hintAr}>
              سنعود قريباً! يرجى المحاولة لاحقاً.
            </Text>
          </View>
        </LinearGradient>
      )}

      {/* Overlay: Force Update */}
      {!showMaintenance && showForceUpdate && (
        <LinearGradient
          colors={["#06091E", "#0D1033", "#1A0A3A"]}
          style={styles.overlay}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.center}>
            <Text style={styles.bigEmoji}>🚀</Text>
            <Text style={styles.mainTitle}>Update Required</Text>
            <Text style={styles.mainTitleAr}>يجب تحديث التطبيق</Text>
            <View style={styles.msgBox}>
              <Text style={styles.msgText}>Your version: {currentVersion}</Text>
              <Text style={styles.msgText}>
                Required: {config.min_app_version}
              </Text>
            </View>
            <Pressable style={styles.updateBtn} onPress={openStore}>
              <LinearGradient
                colors={["#7C3AED", "#A855F7"]}
                style={styles.updateBtnInner}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.updateBtnText}>🔄 Update Now</Text>
              </LinearGradient>
            </Pressable>
            <Text style={styles.hint}>
              Please update to continue using Athkari.
            </Text>
            <Text style={styles.hintAr}>
              يرجى التحديث لمتابعة استخدام أذكاري.
            </Text>
          </View>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  bigEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 4,
  },
  mainTitleAr: {
    fontSize: 22,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginBottom: 20,
  },
  msgBox: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 20,
    marginBottom: 24,
    width: "100%",
    maxWidth: 320,
  },
  msgText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 22,
  },
  hint: {
    fontSize: 13,
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
    marginTop: 8,
  },
  hintAr: {
    fontSize: 13,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    marginTop: 4,
  },
  updateBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  updateBtnInner: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  updateBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
