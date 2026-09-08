import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { unwrapAs } from "@/lib/query/api-error";
import { useApiMutation } from "@/lib/query/use-api-mutation";

import type { components } from "@/api/generated/schema";

/** Mutable event families; mirrors `app/domain/notifications/categories.py`. */
export const NOTIFICATION_CATEGORIES = [
  "chat",
  "attendance",
  "tasks",
  "membership",
  "billing",
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type NotificationPreferences =
  components["schemas"]["NotificationPreferencesResponse"];
/** PUT body: only the switches that moved. The spec marks every field as nullable-required
 * (Pydantic `Optional[bool] = None`), so the partial shape is declared here. */
export type NotificationPreferencesUpdate = Partial<
  Record<"push_enabled" | NotificationCategory, boolean>
>;

export const notificationPreferenceKeys = {
  all: ["notification-preferences"] as const,
};

/** The caller's push opt-outs; a user who never changed anything reads all true. */
export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationPreferenceKeys.all,
    queryFn: async () =>
      unwrapAs<NotificationPreferences>(
        await api.GET("/api/v1/notifications/preferences"),
      ),
  });
}

/**
 * Partial update — send only the switch that moved. The response is the full new state,
 * written straight into the cache so the screen never shows a stale flag.
 */
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useApiMutation<NotificationPreferencesUpdate, NotificationPreferences>(
    {
      mutationFn: async (changes) =>
        unwrapAs<NotificationPreferences>(
          await api.PUT("/api/v1/notifications/preferences", {
            body: changes as never,
          }),
        ),
      onSuccess: (data) =>
        queryClient.setQueryData(notificationPreferenceKeys.all, data),
    },
  );
}
