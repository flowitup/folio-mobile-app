import type { Invoice, InvoiceType } from "@/features/invoices/invoice-types";

export type LineItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate?: number;
};

/** Row total is TTC: qty × price × (1 + vat/100). Legacy rows without vat_rate count as 0 %. */
export function lineTotalTtc(item: LineItemInput): number {
  return item.quantity * item.unit_price * (1 + (item.vat_rate ?? 0) / 100);
}

export function lineTotalHt(item: LineItemInput): number {
  return item.quantity * item.unit_price;
}

/** HT / TVA / TTC breakdown of an item list, matching the web detail footer. */
export function invoiceTotals(items: LineItemInput[]): {
  ht: number;
  tva: number;
  ttc: number;
} {
  const ht = items.reduce((sum, item) => sum + lineTotalHt(item), 0);
  const ttc = items.reduce((sum, item) => sum + lineTotalTtc(item), 0);
  return { ht, tva: ttc - ht, ttc };
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
