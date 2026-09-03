import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { ScreenHeader } from "@/components/ui/screen-header";
import {
  useDismissNotification,
  useNotifications,
} from "@/features/notes/notes-api";
import { formatDate } from "@/lib/format/date";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

/** Dashboard: due-reminder notifications (metrics and charts land in the dashboard phase). */
export default function DashboardTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const notifications = useNotifications();
  const dismiss = useDismissNotification();
  useRefetchOnFocus(notifications.refetch);

  const pending = (notifications.data ?? []).filter((item) => !item.dismissed);

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title={t("tabs.dashboard")} />
      <ScrollView contentContainerClassName="p-4">
        <Text className="mb-2 text-sm font-medium text-muted-foreground">
          {t("notifications.title", { count: pending.length })}
        </Text>
        {notifications.isPending ? <ActivityIndicator /> : null}
        {!notifications.isPending && pending.length === 0 ? (
          <EmptyState message={t("notifications.none")} />
        ) : null}
        {pending.map(({ note }) => (
          <Card key={note.id} className="mb-2">
            <Pressable
              testID={`notification-${note.id}`}
              onPress={() => router.push(`/projects/${note.project_id}/notes`)}
            >
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 pr-2 text-base font-medium text-primary">
                  {note.title}
                </Text>
                <Badge label={t(`notes.categories.${note.category}`)} />
              </View>
              {note.description ? (
                <Text className="text-sm text-primary">{note.description}</Text>
              ) : null}
              {note.due_date ? (
                <Text className="text-xs text-muted-foreground">
                  {t("notifications.due", { date: formatDate(note.due_date) })}
                </Text>
              ) : null}
            </Pressable>
            <Button
              testID={`notification-dismiss-${note.id}`}
              label={t("notifications.dismiss")}
              variant="secondary"
              size="sm"
              className="mt-2"
              onPress={() => dismiss.mutate({ noteId: note.id })}
            />
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
