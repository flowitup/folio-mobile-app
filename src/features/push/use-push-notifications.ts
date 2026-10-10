import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";

import { useAuth } from "@/auth/auth-context";
import { requestShellSheet } from "@/components/shell/shell-context";
import {
  clearHandledPushResponse,
  registerPushDevice,
} from "@/features/push/push-device-registration";
import { selectProjectOnNextShell } from "@/features/projects/selected-project";
import i18n from "@/i18n";
import {
  pushChangesOwnAccess,
  routeForNotification,
  staleKeysForPush,
} from "@/lib/push/notification-route";
import type { PushData } from "@/lib/push/notification-route";

// Show pushes even while the app is in the foreground (banner + sound, no badge count).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Signed-in area: register the device once, refresh the bell when a push arrives in the
 * foreground, and route a tapped push (also the one that launched the app) to the project /
 * the bell sheet.
 */
export function usePushNotifications(): void {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();

  useEffect(() => {
    void registerPushDevice();

    const invalidate = (data: PushData | null | undefined) => {
      for (const queryKey of staleKeysForPush(data))
        void queryClient.invalidateQueries({ queryKey });
      // The user's own role, grants or company access changed: the companies and permissions
      // held in the auth context (`/auth/me`) are stale too.
      if (pushChangesOwnAccess(data)) void refreshUser();
    };

    const open = (data: PushData | null | undefined) => {
      const route = routeForNotification(data);
      if (route.projectId) selectProjectOnNextShell(route.projectId);
      if (route.sheet) requestShellSheet(route.sheet);
      invalidate(data);
      router.navigate(route.path ?? "/(app)/(tabs)");
    };

    const received = Notifications.addNotificationReceivedListener(
      (notification) =>
        invalidate(notification.request.content.data as PushData),
    );
    const responded = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        open(response.notification.request.content.data as PushData);
        clearHandledPushResponse();
      },
    );
    // Cold start from a push: the response is handed over once, before listeners attach. It is
    // cleared once handled, or this group would replay it when it mounts again after sign-in.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      open(response.notification.request.content.data as PushData);
      clearHandledPushResponse();
    });

    // Pushes are rendered server-side in the language the device registered with, so a
    // language picked in Settings (or restored from storage after launch) is re-sent.
    const reRegister = () => void registerPushDevice();
    i18n.on("languageChanged", reRegister);

    return () => {
      i18n.off("languageChanged", reRegister);
      received.remove();
      responded.remove();
    };
  }, [queryClient, router, refreshUser]);
}
