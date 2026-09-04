/**
 * Groups chat messages (already oldest → newest) under day dividers and decides when
 * consecutive messages from the same sender share one name/avatar header.
 */
import { toIsoDate } from "@/lib/format/date";

export interface DayGroup<T> {
  /** `YYYY-MM-DD` of the divider. */
  dayKey: string;
  messages: T[];
}

/** Local-calendar `YYYY-MM-DD` of an ISO timestamp. */
export function dayKeyOf(iso: string): string {
  return toIsoDate(new Date(iso));
}

export function groupMessagesByDay<T extends { created_at: string }>(
  messages: T[],
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const message of messages) {
    const dayKey = dayKeyOf(message.created_at);
    const last = groups[groups.length - 1];
    if (last && last.dayKey === dayKey) last.messages.push(message);
    else groups.push({ dayKey, messages: [message] });
  }
  return groups;
}

/**
 * Divider label: "today" / "yesterday" tokens (translated by the caller) or `dd/mm`.
 * Returns `{ token: "today" | "yesterday" }` or `{ date: "dd/mm" }`.
 */
export function dayDividerLabel(
  dayKey: string,
  today: Date = new Date(),
): { token: "today" | "yesterday" } | { date: string } {
  const todayKey = toIsoDate(today);
  const yesterday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 1,
  );
  if (dayKey === todayKey) return { token: "today" };
  if (dayKey === toIsoDate(yesterday)) return { token: "yesterday" };
  return { date: `${dayKey.slice(8, 10)}/${dayKey.slice(5, 7)}` };
}

/** `HH:mm` in local time. */
export function timeOf(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Whether a message should show the sender header (first of a run from one sender). */
export function showsSender<T extends { sender_id: string; mine: boolean }>(
  messages: T[],
  index: number,
): boolean {
  const current = messages[index];
  if (current.mine) return false;
  const previous = messages[index - 1];
  return !previous || previous.sender_id !== current.sender_id;
}
