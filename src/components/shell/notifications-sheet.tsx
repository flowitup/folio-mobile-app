import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { useShell } from "@/components/shell/shell-context";
import { ShellSheet } from "@/components/shell/shell-sheet";
import { Badge } from "@/components/ui/primitives";
import { Eyebrow } from "@/components/ui/typography";
import {
  useDismissNotification,
  useNotifications,
} from "@/features/notes/notes-api";
import { formatDate } from "@/lib/format/date";
import { useTokens } from "@/theme/tokens";

/** Bell sheet: due reminders (notes with a due date) across projects, tap to open, "Bỏ qua" to dismiss. */
export function NotificationsSheet() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const router = useRouter();
  const { sheet, closeSheet } = useShell();
  const notifications = useNotifications();
  const dismiss = useDismissNotification();
  const pending = (notifications.data ?? []).filter((item) => !item.dismissed);

  return (
    <ShellSheet open={sheet === "notifications"} testID="notifications-sheet">
      <Eyebrow className="mb-2">
        {t("notifications.title", { count: pending.length })}
      </Eyebrow>
      <View className="overflow-hidden rounded-xl border border-line bg-card">
        {notifications.isPending ? (
          <ActivityIndicator className="my-6" color={tokens.ink} />
        ) : null}
        {!notifications.isPending && pending.length === 0 ? (
          <Text className="px-3.5 py-4 font-sans text-[14px] text-muted">
            {t("notifications.none")}
          </Text>
        ) : null}
        <ScrollView style={{ maxHeight: 360 }} bounces={false}>
          {pending.map(({ note }) => (
            <View
              key={note.id}
              className="flex-row items-center gap-3 border-b border-line px-3.5 py-3"
            >
              <Pressable
                testID={`notification-${note.id}`}
                accessibilityRole="button"
                onPress={() => {
                  closeSheet();
                  router.push(`/projects/${note.project_id}/notes`);
                }}
                className="min-w-0 flex-1 active:opacity-70"
              >
                <Text
                  className="font-sans-medium text-[14px] text-ink"
                  numberOfLines={1}
                >
                  {note.title}
                </Text>
                <View className="mt-1 flex-row items-center gap-2">
                  <Badge label={t(`notes.categories.${note.category}`)} />
                  {note.due_date ? (
                    <Text className="font-mono text-[11.5px] text-muted">
                      {t("notifications.due", {
                        date: formatDate(note.due_date),
                      })}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              <Pressable
                testID={`notification-dismiss-${note.id}`}
                accessibilityRole="button"
                onPress={() => dismiss.mutate({ noteId: note.id })}
                hitSlop={8}
                className="active:opacity-70"
              >
                <Text className="font-sans text-xs text-accent-ink">
                  {t("notifications.dismiss")}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
    </ShellSheet>
  );
}
