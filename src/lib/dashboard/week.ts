import { toIsoDate } from "@/lib/format/date";

/** `YYYY-MM-DD` from local calendar fields (same as the web planning helper). */
export const toDateKey = (date: Date): string => toIsoDate(date);

/** Monday 00:00 of the week containing `date`. */
export function startOfWeekMonday(date: Date): Date {
  const day = date.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff);
}

export function addWeeks(date: Date, weeks: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + weeks * 7,
  );
}
