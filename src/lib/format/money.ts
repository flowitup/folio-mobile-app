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

/**
 * Parses an amount typed in any of the app's locales: "12 500,75", "12.500,75", "12,500.75".
 * Same rules as the web's parseMoneyInput (folio-front-end src/lib/utils/parse-money-input.ts):
 * - spaces (also no-break and narrow no-break) and a trailing "€" are dropped;
 * - with both "," and ".", the right-most one is the decimal mark, the other is grouping
 *   and must group by three ("1.234,5" yes, "1.23,5" no);
 * - several identical separators are grouping only ("1.500.000" is 1 500 000, never 1 500);
 * - a single separator followed by exactly three digits ("1.500", "1,340") is ambiguous
 *   (1 500 to most fr/vi users, 1.5 to some en users) and is refused unless the field reads
 *   it as a decimal (`ambiguousGrouping: "decimal"`, e.g. a quantity of 2,375 m³);
 * - at most `maxDecimals` decimals; a leading minus only with `allowNegative`.
 * The mobile defaults stay as permissive as before on decimals and sign (each caller checks
 * its own range), but never misread grouping.
 */
const GROUPED_RE = /^\d{1,3}(?:[.,]\d{3})+$/;
const AMBIGUOUS_RE = /^[1-9]\d{0,2}[.,]\d{3}$/;

export type ParseMoneyInputOptions = {
  /** Most decimals accepted; default 6. */
  maxDecimals?: number;
  /** Accept a leading minus sign; default true (callers check their own range). */
  allowNegative?: boolean;
  /** How to read "1,500": "reject" (default) refuses it as ambiguous, "decimal" reads 1.5. */
  ambiguousGrouping?: "reject" | "decimal";
};

export type MoneyInputError =
  "empty" | "invalid" | "ambiguous" | "tooManyDecimals" | "negative";

export type ParsedMoneyInput = {
  value: number | null;
  error: MoneyInputError | null;
  /** For "ambiguous": the amount read as a thousands group (1,500 -> 1500). */
  suggestion?: number;
};

export function parseMoneyInputDetailed(
  raw: string,
  {
    maxDecimals = 6,
    allowNegative = true,
    ambiguousGrouping = "reject",
  }: ParseMoneyInputOptions = {},
): ParsedMoneyInput {
  let s = raw.replace(/[\s\u00a0\u202f€]/g, "");
  let sign = 1;
  if (/^[-−]/.test(s)) {
    if (!allowNegative)
      return { value: null, error: /^[-−]\d/.test(s) ? "negative" : "invalid" };
    sign = -1;
    s = s.slice(1);
  }
  if (s === "")
    return { value: null, error: sign === -1 ? "invalid" : "empty" };

  if (
    AMBIGUOUS_RE.test(s) &&
    !(maxDecimals >= 3 && ambiguousGrouping === "decimal")
  ) {
    return {
      value: null,
      error: "ambiguous",
      suggestion: sign * Number(s.replace(/[.,]/, "")),
    };
  }

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? "," : ".";
    const grouping = decimal === "," ? "." : ",";
    const [intPart, decPart, ...rest] = s.split(decimal);
    if (rest.length > 0 || !GROUPED_RE.test(intPart))
      return { value: null, error: "invalid" };
    s = `${intPart.split(grouping).join("")}.${decPart}`;
  } else if (lastComma !== -1 || lastDot !== -1) {
    const sep = lastComma !== -1 ? "," : ".";
    if (s.indexOf(sep) !== s.lastIndexOf(sep)) {
      if (!GROUPED_RE.test(s)) return { value: null, error: "invalid" };
      s = s.split(sep).join("");
    } else {
      s = s.replace(sep, ".");
    }
  }

  if (!/^\d+(?:\.\d+)?$/.test(s)) return { value: null, error: "invalid" };
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${maxDecimals}})?$`).test(s))
    return { value: null, error: "tooManyDecimals" };
  const value = Number(s);
  return Number.isFinite(value)
    ? { value: sign * value, error: null }
    : { value: null, error: "invalid" };
}

/** The amount typed, or null when the text is empty or not a valid amount (see parseMoneyInputDetailed). */
export function parseMoneyInput(
  text: string,
  options: ParseMoneyInputOptions = {},
): number | null {
  return parseMoneyInputDetailed(text, options).value;
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

/**
 * A stored number as the text of an input in the active locale (`12500,5` in fr/vi, `12500.5`
 * in en): no thousands separator, at most `maxDecimals`, at least `minDecimals` once it has a
 * fraction. A value that would read as ambiguous ("1,859") gets a fourth decimal ("1,8590")
 * when the field keeps four, so parseMoneyInput always reads the prefill back.
 */
export function formatNumberInput(
  value: number | string | null | undefined,
  {
    minDecimals = 0,
    maxDecimals = 4,
    padAmbiguous = true,
  }: {
    minDecimals?: number;
    maxDecimals?: number;
    /** False for a field that reads "2,375" as a decimal (a quantity). */
    padAmbiguous?: boolean;
  } = {},
): string {
  if (value === null || value === undefined || value === "") return "";
  const number = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(number)) return "";
  const rounded = Number(number.toPrecision(15));
  const scale = 10 ** maxDecimals;
  const hasFraction = Math.round(Math.abs(rounded) * scale) % scale !== 0;
  const text = new Intl.NumberFormat(LOCALE_TAG[i18n.language] ?? "en-GB", {
    useGrouping: false,
    minimumFractionDigits: hasFraction ? Math.min(minDecimals, maxDecimals) : 0,
    maximumFractionDigits: maxDecimals,
  }).format(rounded);
  return padAmbiguous &&
    maxDecimals > 3 &&
    AMBIGUOUS_RE.test(text.replace(/^[-−]/, ""))
    ? `${text}0`
    : text;
}
