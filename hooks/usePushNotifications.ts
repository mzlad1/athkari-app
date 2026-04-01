import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { notificationService } from "@/services/notifications";
import { useAuth } from "@/contexts/AuthContext";

export function usePushNotifications() {
  const { family, kids, activeKid, role } = useAuth();
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowInForeground: true,
      }),
    });

    registerForPushNotifications();
  }, [family?.id, kids?.length, activeKid?.id, role]);

  async function registerForPushNotifications() {
    if (!family?.id) return;

    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;

      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") return;

      // Get the Expo push token
      const projectId =
        process.env.EXPO_PUBLIC_PROJECT_ID ||
        Constants.expoConfig?.extra?.eas?.projectId;

      if (!projectId) {
        console.warn("Push: No EAS projectId configured");
        return;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      const token = tokenData.data;
      tokenRef.current = token;

      if (role === "kid") {
        // Kid's own device — register token ONLY for the active kid
        if (activeKid) {
          await notificationService.registerToken(
            family.id,
            activeKid.id,
            token,
            Platform.OS,
          );
        }
      } else {
        // Parent device — register for parent + all kids (shared device)
        await notificationService.registerToken(
          family.id,
          null,
          token,
          Platform.OS,
        );

        if (kids && kids.length > 0) {
          for (const kid of kids) {
            await notificationService.registerToken(
              family.id,
              kid.id,
              token,
              Platform.OS,
            );
          }
        }
      }

      // Android channel
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#7C3AED",
        });
      }
    } catch (err) {
      console.warn("Push notification registration failed:", err);
    }
  }

  return { token: tokenRef.current };
}
