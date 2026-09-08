import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";

import { Card, EmptyState, ListRow } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import {
  NOTIFICATION_CATEGORIES,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/features/notifications/notification-preferences-api";
import type {
  NotificationCategory,
  NotificationPreferences,
} from "@/features/notifications/notification-preferences-api";
import { useTokens } from "@/theme/tokens";

type PreferenceKey = "push_enabled" | NotificationCategory;

/**
 * Settings → Notifications: the master switch plus one switch per event family, bound to
 * GET/PUT /notifications/preferences. A flicked switch moves at once (local override) and
 * snaps back if the save fails — `useApiMutation` toasts the error.
 */
export default function NotificationPreferencesScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const prefs = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  // Optimistic view while a save is in flight; cleared on settle so the cache wins again.
  const [optimistic, setOptimistic] = useState<NotificationPreferences | null>(
    null,
  );
  const current = optimistic ?? prefs.data ?? null;

  const toggle = (key: PreferenceKey, value: boolean) => {
    if (!current) return;
    setOptimistic({ ...current, [key]: value });
    update.mutate({ [key]: value }, { onSettled: () => setOptimistic(null) });
  };

  const switchFor = (key: PreferenceKey, disabled: boolean) => (
    <Switch
      testID={`notification-pref-${key}`}
      value={current?.[key] ?? true}
      disabled={disabled}
      onValueChange={(value) => toggle(key, value)}
      trackColor={{ true: tokens.accent, false: tokens.line }}
      accessibilityLabel={
        key === "push_enabled"
          ? t("settings.notificationPrefs.pushEnabled")
          : t(`settings.notificationPrefs.categories.${key}`)
      }
    />
  );

  return (
    <View className="flex-1 bg-paper">
      <ScreenHeader title={t("settings.notificationPrefs.title")} back />
      <ScrollView
        contentContainerClassName="px-4 pb-6 pt-3.5"
        contentContainerStyle={{ gap: 12 }}
      >
        <Text className="font-sans text-[13px] text-muted">
          {t("settings.notificationPrefs.intro")}
        </Text>
        {prefs.isPending ? <ActivityIndicator className="mt-8" /> : null}
        {prefs.isError ? (
          <EmptyState message={t("settings.notificationPrefs.loadError")} />
        ) : null}
        {current ? (
          <Card
            padded={false}
            className="overflow-hidden"
            testID="notification-prefs"
          >
            <ListRow
              grouped
              title={t("settings.notificationPrefs.pushEnabled")}
              subtitle={t("settings.notificationPrefs.pushEnabledDesc")}
              right={switchFor("push_enabled", update.isPending)}
            />
            {NOTIFICATION_CATEGORIES.map((category) => (
              <ListRow
                key={category}
                grouped
                title={t(`settings.notificationPrefs.categories.${category}`)}
                subtitle={t(
                  `settings.notificationPrefs.categories.${category}Desc`,
                )}
                // A muted master switch makes every category moot; greying them says so.
                right={switchFor(
                  category,
                  update.isPending || !current.push_enabled,
                )}
              />
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
