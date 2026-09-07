/**
 * French public holidays (jours fériés) for any given year — ported verbatim from the web
 * app (`src/lib/utils/french-holidays.ts`) so both clients mark the same days.
 *
 * Combines fixed-date holidays with movable feasts derived from Easter. Returns a stable
 * translation key when the given date is a public holiday, or null otherwise. Callers resolve
 * the key via i18next (`labor.holidays.*`) so the display follows the user's locale.
 *
 * Easter date uses the anonymous Gregorian algorithm (Meeus/Jones/Butcher).
 */

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Stable translation keys under `labor.holidays.*` in the locale files. */
export type FrenchHolidayKey =
  | "newYear"
  | "labourDay"
  | "victory1945"
  | "bastilleDay"
  | "assumption"
  | "allSaints"
  | "armistice1918"
  | "christmas"
  | "easterMonday"
  | "ascension"
  | "pentecostMonday";

function getFrenchHolidays(year: number): Map<string, FrenchHolidayKey> {
  const easter = easterSunday(year);
  const fixed: [number, number, FrenchHolidayKey][] = [
    [0, 1, "newYear"],
    [4, 1, "labourDay"],
    [4, 8, "victory1945"],
    [6, 14, "bastilleDay"],
    [7, 15, "assumption"],
    [10, 1, "allSaints"],
    [10, 11, "armistice1918"],
    [11, 25, "christmas"],
  ];
  const holidays = new Map<string, FrenchHolidayKey>();
  for (const [m, d, key] of fixed)
    holidays.set(dateKey(new Date(year, m, d)), key);
  holidays.set(dateKey(addDays(easter, 1)), "easterMonday");
  holidays.set(dateKey(addDays(easter, 39)), "ascension");
  holidays.set(dateKey(addDays(easter, 50)), "pentecostMonday");
  return holidays;
}

const cache = new Map<number, Map<string, FrenchHolidayKey>>();

/** Holiday key for a `YYYY-MM-DD` ISO day (the calendar's cell format), or null. */
export function frenchHolidayKeyForIso(iso: string): FrenchHolidayKey | null {
  const year = Number(iso.slice(0, 4));
  if (!Number.isFinite(year)) return null;
  let yearMap = cache.get(year);
  if (!yearMap) {
    yearMap = getFrenchHolidays(year);
    cache.set(year, yearMap);
  }
  return yearMap.get(iso) ?? null;
}

/** Holiday key for a local Date, or null. */
export function getFrenchHolidayKey(date: Date): FrenchHolidayKey | null {
  return frenchHolidayKeyForIso(dateKey(date));
}
