import { localeTag, toIsoDate } from "@/lib/format/date";

/** API timestamp (naive UTC, `…Z` or `…+00:00`) as a Date; null when it cannot be read. */
function parseInstant(iso: string): Date | null {
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$/.exec(
      iso,
    );
  const date = new Date(
    match
      ? `${match[1]}${match[2] ? `.${match[2].slice(0, 3).padEnd(3, "0")}` : ""}${match[3] ?? "Z"}`
      : iso,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export type EventTime =
  { day: "today" | "yesterday"; time: string } | { day: "date"; date: string };

/**
 * When a bell entry happened, in device time: `HH:mm` today, yesterday + `HH:mm`, otherwise a
 * short date (`15 oct.`), with the year only when it is not the current one. The caller words
 * "yesterday" in the app language.
 */
export function eventTime(iso: string, now: Date = new Date()): EventTime {
  const date = parseInstant(iso);
  if (!date) return { day: "date", date: iso.slice(0, 10) };
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const key = toIsoDate(date);
  if (key === toIsoDate(now)) return { day: "today", time };
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );
  if (key === toIsoDate(yesterday)) return { day: "yesterday", time };
  return {
    day: "date",
    date: new Intl.DateTimeFormat(localeTag(), {
      day: "numeric",
      month: "short",
      ...(date.getFullYear() === now.getFullYear()
        ? {}
        : { year: "numeric" as const }),
    }).format(date),
  };
}
