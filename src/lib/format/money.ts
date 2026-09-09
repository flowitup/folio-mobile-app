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
