import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";

import { requestShellSheet } from "@/components/shell/shell-context";
import { registerPushDevice } from "@/features/push/push-device-registration";
import { selectProjectOnNextShell } from "@/features/projects/selected-project";
import { routeForNotification } from "@/lib/push/notification-route";
import type { PushData } from "@/lib/push/notification-route";

const NOTIFICATIONS_KEY = ["notifications"] as const;

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

  useEffect(() => {
    void registerPushDevice();

    const open = (data: PushData | null | undefined) => {
      const route = routeForNotification(data);
      if (route.projectId) selectProjectOnNextShell(route.projectId);
      if (route.sheet) requestShellSheet(route.sheet);
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      router.navigate("/(app)/(tabs)");
    };

    const received = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    });
    const responded = Notifications.addNotificationResponseReceivedListener(
      (response) =>
        open(response.notification.request.content.data as PushData),
    );
    // Cold start from a push: the response is handed over once, before listeners attach.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response)
        open(response.notification.request.content.data as PushData);
    });

    return () => {
      received.remove();
      responded.remove();
    };
  }, [queryClient, router]);
}
