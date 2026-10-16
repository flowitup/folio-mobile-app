import type { NotificationsResponse } from "@/features/notes/notes-api";

/** Unread activity: the server's total when it sends one, else the unread rows of the page. */
export function unreadActivityCount(
  data: Pick<NotificationsResponse, "events" | "events_unread"> | undefined,
): number {
  if (!data) return 0;
  return (
    data.events_unread ??
    (data.events ?? []).filter((event) => !event.read).length
  );
}

/** What the bell badge counts: open reminders, days to validate, new members, unread activity
 * (the same sum as the web bell). */
export function bellCount(data: NotificationsResponse | undefined): number {
  if (!data) return 0;
  return (
    (data.items ?? []).filter((item) => !item.dismissed).length +
    (data.attendance_pending ?? []).length +
    (data.company_events ?? []).length +
    unreadActivityCount(data)
  );
}
