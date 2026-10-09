import i18n from "@/i18n";

const LOCALE_TAG: Record<string, string> = {
  en: "en-GB",
  fr: "fr-FR",
  vi: "vi-VN",
};

/** BCP-47 tag of the active UI language (en-GB / fr-FR / vi-VN). */
export function localeTag(): string {
  return LOCALE_TAG[i18n.language] ?? "en-GB";
}

/**
 * `YYYY-MM-DD` → local Date at midnight, or null when unparsable. Also accepts the RFC-1123
 * form Flask emits for bare `date` fields (`Thu, 03 Sep 2026 00:00:00 GMT`), read as a UTC day.
 */
export function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match)
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
  );
}

/** Date → `YYYY-MM-DD` using local calendar fields (never UTC, avoids off-by-one across midnight). */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Europe/Paris year / month / day formatters; one field each so no locale order or separator is parsed. */
let parisFields: Intl.DateTimeFormat[] | null = null;

/**
 * `YYYY-MM-DD` of the Europe/Paris calendar day holding the ISO timestamp, as the web groups photos
 * (a `22:30Z` capture is the next day in Paris). Falls back to the timestamp's own date prefix.
 */
export function parisDayKey(iso: string): string {
  // `2026-10-09T19:37:13.433392+00:00` (Python's isoformat): fractional seconds cut to milliseconds,
  // which every JS engine parses; no offset means UTC.
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$/.exec(
      iso,
    );
  const date = new Date(
    match
      ? `${match[1]}${match[2] ? `.${match[2].slice(0, 3).padEnd(3, "0")}` : ""}${match[3] ?? "Z"}`
      : iso,
  );
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  try {
    parisFields ??= (["year", "month", "day"] as const).map(
      (field) =>
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Europe/Paris",
          [field]: field === "year" ? "numeric" : "2-digit",
        }),
    );
    const key = parisFields.map((f) => f.format(date)).join("-");
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
  } catch {
    // No time zone support in this Intl: keep the timestamp's own day.
  }
  return iso.slice(0, 10);
}

/** Human date in the active locale, e.g. `3 sept. 2026`. */
export function formatDate(iso: string | null | undefined): string {
  const date = parseIsoDate(iso);
  if (!date) return "";
  return new Intl.DateTimeFormat(localeTag(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Human date of an API timestamp in the device time zone (`timeZone` only for tests). Takes naive UTC
 * (`2026-10-09T18:04:43.480832`), `…+00:00` and `Fri, 09 Oct 2026 18:04:43 GMT`; formatDate would show
 * the UTC day, a day early for an evening upload in Vietnam. A bare `YYYY-MM-DD` stays a calendar day.
 */
export function formatInstant(
  iso: string | null | undefined,
  timeZone?: string,
): string {
  if (!iso || /^\d{4}-\d{2}-\d{2}$/.test(iso)) return formatDate(iso);
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$/.exec(
      iso,
    );
  // No offset means UTC; fractional seconds are cut to milliseconds, which every JS engine parses.
  const date = new Date(
    match
      ? `${match[1]}${match[2] ? `.${match[2].slice(0, 3).padEnd(3, "0")}` : ""}${match[3] ?? "Z"}`
      : iso,
  );
  if (Number.isNaN(date.getTime())) return formatDate(iso);
  return new Intl.DateTimeFormat(localeTag(), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(date);
}

/**
 * `YYYY-MM-DD` of the device's calendar day holding an API timestamp (naive UTC, `…+00:00` or
 * RFC-1123), for grouping by day: slicing the string gives the UTC day, so a note written at 00:30
 * in Paris would sit under the day before. Falls back to the timestamp's own date prefix.
 */
export function localDayKey(iso: string): string {
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$/.exec(
      iso,
    );
  const date = new Date(
    match
      ? `${match[1]}${match[2] ? `.${match[2].slice(0, 3).padEnd(3, "0")}` : ""}${match[3] ?? "Z"}`
      : iso,
  );
  return Number.isNaN(date.getTime()) ? iso.slice(0, 10) : toIsoDate(date);
}

/** `YYYY-MM` → `septembre 2026`. */
export function formatMonth(month: string): string {
  const date = parseIsoDate(`${month}-01`);
  if (!date) return month;
  return new Intl.DateTimeFormat(localeTag(), {
    month: "long",
    year: "numeric",
  }).format(date);
}

/** `YYYY-MM` shifted by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth(): string {
  return toIsoDate(new Date()).slice(0, 7);
}
