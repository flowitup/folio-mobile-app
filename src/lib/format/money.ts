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

/** Parses user-typed amounts accepting both `,` and `.` decimals and spaces as thousands separators. */
export function parseMoneyInput(text: string): number | null {
  const normalized = text.replace(/\s/g, "").replace(",", ".");
  if (normalized === "" || normalized === "-" || normalized === ".")
    return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
