import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { api } from "@/api/client";

// Remembered so sign-out can tell the backend to forget this device.
const PUSH_TOKEN_KEY = "folio.push.token";

/**
 * Ask for permission and register this device's Expo push token for the signed-in user.
 * Silent no-op wherever a token cannot exist: simulators/emulators, denied permission, or a
 * build without the EAS project / APNs / FCM credentials — the bell polling still works.
 */
export async function registerPushDevice(): Promise<string | null> {
  try {
    if (Platform.OS === "android")
      await Notifications.setNotificationChannelAsync("default", {
        name: "Folio",
        importance: Notifications.AndroidImportance.HIGH,
      });
    const current = await Notifications.getPermissionsAsync();
    const status = current.granted
      ? current
      : await Notifications.requestPermissionsAsync();
    if (!status.granted) return null;
    // Simulators / emulators can show local and simulated notifications but never get a token.
    if (!Device.isDevice) return null;
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const { response } = await api.POST("/api/v1/push/devices", {
      body: { token, platform: Platform.OS === "ios" ? "ios" : "android" },
    });
    if (!response.ok) return null;
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
    return token;
  } catch (error) {
    if (__DEV__) console.warn("[push] registration skipped:", error);
    return null;
  }
}

/** Sign-out: forget the token server-side (best effort) and locally. */
export async function unregisterPushDevice(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (!token) return;
    await api
      .DELETE("/api/v1/push/devices", { body: { token } })
      .catch(() => undefined);
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  } catch {
    // Nothing to clean up.
  }
}
