import type { Invoice, InvoiceType } from "@/features/invoices/invoice-types";
import { round2 } from "@/lib/billing/billing-totals";

export type LineItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate?: number;
};

/**
 * Row total is TTC: qty × price × (1 + vat/100), rounded half-up to the cent as the API
 * stores it. Legacy rows without vat_rate count as 0 %.
 */
export function lineTotalTtc(item: LineItemInput): number {
  return round2(
    item.quantity * item.unit_price * (1 + (item.vat_rate ?? 0) / 100),
  );
}

/** Row total before VAT: qty × price, rounded half-up to the cent like the TTC. */
export function lineTotalHt(item: LineItemInput): number {
  return round2(item.quantity * item.unit_price);
}

/**
 * HT / TVA / TTC breakdown of an item list, matching the web detail footer. TTC is the sum of
 * the rounded line totals (the API's total_amount), HT the sum of the rounded line HTs and TVA
 * the rest, so the shown lines add up to TTC, HT + TVA = TTC, and 0 % lines carry no TVA.
 */
export function invoiceTotals(items: LineItemInput[]): {
  ht: number;
  tva: number;
  ttc: number;
} {
  const ht = round2(items.reduce((sum, item) => sum + lineTotalHt(item), 0));
  const ttc = round2(items.reduce((sum, item) => sum + lineTotalTtc(item), 0));
  return { ht, tva: round2(ttc - ht), ttc };
}

/** Types that carry a VAT column on the web ledger (labor is flat, "all" is uniform). */
export const VAT_TYPES: InvoiceType[] = [
  "released_funds",
  "materials_services",
  "others",
  "return",
];

/** Web highlight palette (Tailwind 300-ish tints) keyed by the API enum. */
export const HIGHLIGHT_COLORS: Record<
  NonNullable<Invoice["highlight_color"]>,
  string
> = {
  red: "#fecaca",
  orange: "#fed7aa",
  yellow: "#fef08a",
  green: "#bbf7d0",
  blue: "#bfdbfe",
  purple: "#e9d5ff",
};

/**
 * Translucent ledger-row tint of a highlight color (the web's `highlightRowTint`), so the row reads
 * in light and dark mode alike; undefined when unset or not in the palette.
 */
const HIGHLIGHT_ROW_TINTS: Record<
  NonNullable<Invoice["highlight_color"]>,
  string
> = {
  red: "rgba(239, 68, 68, 0.14)",
  orange: "rgba(249, 115, 22, 0.14)",
  yellow: "rgba(234, 179, 8, 0.16)",
  green: "rgba(34, 197, 94, 0.14)",
  blue: "rgba(59, 130, 246, 0.14)",
  purple: "rgba(168, 85, 247, 0.14)",
};

export function highlightRowTint(
  color: Invoice["highlight_color"],
): string | undefined {
  return color ? HIGHLIGHT_ROW_TINTS[color] : undefined;
}
