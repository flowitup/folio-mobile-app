import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useShell } from "@/components/shell/shell-context";
import { ShellSheet } from "@/components/shell/shell-sheet";
import { AttendanceRequestsSection } from "@/components/shell/attendance-requests-section";
import { Badge } from "@/components/ui/primitives";
import { Eyebrow } from "@/components/ui/typography";
import {
  useDismissNotification,
  useMarkActivityRead,
  useNotifications,
  type ActivityEvent,
} from "@/features/notes/notes-api";
import { useSelectedProject } from "@/features/projects/selected-project";
import { formatDate, formatInstant } from "@/lib/format/date";
import { routeForNotification } from "@/lib/push/notification-route";
import { useTokens } from "@/theme/tokens";

/**
 * Bell sheet: attendance entries waiting for this manager's validation (Duyệt / Từ chối), then
 * due reminders (notes with a due date) across projects — tap to open, "Bỏ qua" to dismiss —
 * then the activity feed (chat, tasks, invoices, membership): a tap marks the entry read and
 * lands where the push would have.
 */
export function NotificationsSheet() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const router = useRouter();
  const { sheet, closeSheet } = useShell();
  const { select } = useSelectedProject();
  const notifications = useNotifications();
  const dismiss = useDismissNotification();
  const markRead = useMarkActivityRead();
  const pending = (notifications.data?.items ?? []).filter(
    (item) => !item.dismissed,
  );
  const attendance = notifications.data?.attendance_pending ?? [];
  const companyEvents = notifications.data?.company_events ?? [];
  const events = notifications.data?.events ?? [];
  const unreadEvents = events.filter((event) => !event.read).length;

  function openEvent(event: ActivityEvent) {
    if (!event.read) markRead.mutate({ ids: [event.id] });
    const route = routeForNotification(event.data);
    if (!route.path && !route.projectId) return;
    closeSheet();
    if (route.projectId) select(route.projectId);
    if (route.path) router.push(route.path as never);
  }

  return (
    <ShellSheet
      open={sheet === "notifications"}
      testID="notifications-sheet"
      scroll
    >
      <AttendanceRequestsSection items={attendance} />
      {companyEvents.length > 0 ? (
        <View className="mb-4">
          <Eyebrow className="mb-2">
            {t("notifications.newMembers.title", {
              count: companyEvents.length,
            })}
          </Eyebrow>
          <View className="overflow-hidden rounded-xl border border-line bg-card">
            {companyEvents.map((event, index) => (
              <Pressable
                key={`${event.company_id}-${event.user_id}`}
                testID={`notification-new-member-${event.user_id}`}
                accessibilityRole="button"
                onPress={() => {
                  closeSheet();
                  router.push("/company/members");
                }}
                className={`flex-row items-center justify-between px-3.5 py-3 active:opacity-70 ${
                  index === companyEvents.length - 1
                    ? ""
                    : "border-b border-line"
                }`}
              >
                <Text
                  className="font-sans-medium text-[14px] text-ink"
                  numberOfLines={1}
                >
                  {event.display_name}
                </Text>
                <Text className="font-sans text-[11.5px] text-muted">
                  {t("notifications.newMembers.unassigned")}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
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
        <View>
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
                  // A reminder can belong to another project: switch the shell to it first, as
                  // a tapped push does, so the tabs and the notes show the same project.
                  select(note.project_id);
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
        </View>
      </View>
      {events.length > 0 ? (
        <View className="mt-4">
          <View className="mb-2 flex-row items-center justify-between">
            <Eyebrow>
              {t("notifications.activity.title", { count: unreadEvents })}
            </Eyebrow>
            {unreadEvents > 0 ? (
              <Pressable
                testID="notification-mark-all-read"
                accessibilityRole="button"
                onPress={() => markRead.mutate({})}
                hitSlop={8}
                className="active:opacity-70"
              >
                <Text className="font-sans text-xs text-accent-ink">
                  {t("notifications.activity.markAllRead")}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <View className="overflow-hidden rounded-xl border border-line bg-card">
            {events.map((event) => (
              <Pressable
                key={event.id}
                testID={`notification-event-${event.id}`}
                accessibilityRole="button"
                onPress={() => openEvent(event)}
                className="flex-row items-start gap-2.5 border-b border-line px-3.5 py-3 active:opacity-70"
              >
                <View
                  testID={
                    event.read
                      ? undefined
                      : `notification-event-unread-${event.id}`
                  }
                  className={`mt-1.5 h-2 w-2 rounded-full ${event.read ? "" : "bg-accent"}`}
                />
                <View className="min-w-0 flex-1">
                  <Text
                    className={`text-[14px] text-ink ${event.read ? "font-sans" : "font-sans-medium"}`}
                    numberOfLines={1}
                  >
                    {event.title}
                  </Text>
                  {event.body ? (
                    <Text
                      className="font-sans text-[12.5px] text-muted"
                      numberOfLines={2}
                    >
                      {event.body}
                    </Text>
                  ) : null}
                  <Text className="mt-0.5 font-mono text-[11px] text-muted">
                    {formatInstant(event.created_at)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </ShellSheet>
  );
}
