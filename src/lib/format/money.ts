import i18n from "@/i18n";

const LOCALE_TAG: Record<string, string> = {
  en: "en-GB",
  fr: "fr-FR",
  vi: "vi-VN",
};

/** Euro amount in the active locale: `1 234,56 €` (fr), `€1,234.56` (en). Null → empty string. */
export function formatMoney(
  amount: number | string | null | undefined,
  currency = "EUR",
): string {
  if (amount === null || amount === undefined || amount === "") return "";
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(LOCALE_TAG[i18n.language] ?? "en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * A line's unit price like formatMoney, but with the decimals it carries (`15,015 €`, `200,00 €`):
 * quantity × a price rounded to the cent would not give the line amount shown next to it.
 * Capped at 6 decimals, which also hides float noise.
 */
export function formatUnitPrice(
  amount: number | string | null | undefined,
  currency = "EUR",
): string {
  if (amount === null || amount === undefined || amount === "") return "";
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(LOCALE_TAG[i18n.language] ?? "en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value);
}

/**
 * Plain number (quantity, VAT rate, day count) in the active locale, trailing zeros dropped:
 * `1,5` (fr, vi), `1.5` (en). Null or unreadable → empty string.
 */
export function formatNumber(
  value: number | string | null | undefined,
  maximumFractionDigits = 3,
): string {
  if (value === null || value === undefined || value === "") return "";
  const number = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(number)) return "";
  return new Intl.NumberFormat(LOCALE_TAG[i18n.language] ?? "en-GB", {
    maximumFractionDigits,
  }).format(number);
}

/**
 * Splits a formatted amount for the 1b headline figures: `main` is everything up to the last
 * integer digit (`97.640`, `€97,640`), `rest` the decimals and currency that follow (`,00 €`,
 * `.00`) and are rendered smaller and muted. Implemented by diffing the full format against the
 * integer-only format because Hermes on iOS has no `Intl.NumberFormat.formatToParts`.
 */
export function splitMoney(
  amount: number | string | null | undefined,
  currency = "EUR",
): { main: string; rest: string } {
  const full = formatMoney(amount, currency);
  if (full === "") return { main: "", rest: "" };
  const value =
    typeof amount === "string" ? Number(amount) : (amount as number);
  // Same rounding as the full format, then the integer part only.
  const integer = Math.trunc(Math.round(value * 100) / 100);
  const integerOnly = new Intl.NumberFormat(
    LOCALE_TAG[i18n.language] ?? "en-GB",
    {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    },
  ).format(integer);
  let common = 0;
  while (
    common < full.length &&
    common < integerOnly.length &&
    full[common] === integerOnly[common]
  )
    common += 1;
  // Keep the split only when the shared prefix ends on a digit (i.e. after the integer part).
  if (common === 0 || !/\d/.test(full[common - 1]))
    return { main: full, rest: "" };
  return { main: full.slice(0, common), rest: full.slice(common) };
}

/** Parses user-typed amounts accepting both `,` and `.` decimals and spaces as thousands separators. */
export function parseMoneyInput(text: string): number | null {
  // Last separator is the decimal mark; every earlier "." or "," is a thousands separator.
  const compact = text.replace(/\s/g, "");
  const lastSeparator = Math.max(
    compact.lastIndexOf(","),
    compact.lastIndexOf("."),
  );
  const normalized =
    lastSeparator === -1
      ? compact
      : compact.slice(0, lastSeparator).replace(/[.,]/g, "") +
        "." +
        compact.slice(lastSeparator + 1);
  if (normalized === "" || normalized === "-" || normalized === ".")
    return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** A typed amount rounded to the cents the server stores, so "0,004" reads as 0 rather than passing a "> 0" check. */
export function parseCentsInput(text: string): number | null {
  const value = parseMoneyInput(text);
  return value === null ? null : Math.round(value * 100) / 100;
}

/**
 * A computed amount as the text of an amount field: cents only, the locale's decimal mark, no
 * thousands separator (`49,66` in fr/vi, `49.66` in en), so float noise such as `149.99 - 100.33`
 * (`49.66000000000001`) is never pre-filled. parseMoneyInput reads it back.
 */
export function formatAmountInput(value: number): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(LOCALE_TAG[i18n.language] ?? "en-GB", {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(Number(value.toPrecision(15)));
}
