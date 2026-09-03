import i18n from "@/i18n";

const LOCALE_TAG: Record<string, string> = {
  en: "en-GB",
  fr: "fr-FR",
  vi: "vi-VN",
};

function localeTag(): string {
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
