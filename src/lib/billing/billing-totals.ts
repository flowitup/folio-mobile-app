/**
 * Live-preview totals for a billing document, with the backend's rounding rule: each line's
 * HT is rounded half-up to the cent, its TVA is rounded half-up from that HT, and the totals
 * are sums of those cent amounts. The form then shows the figures the saved document, its
 * PDF and its XLSX carry.
 */

import { parseMoneyInput } from "@/lib/format/money";

export type TotalsItem = {
  quantity: string;
  unit_price: string;
  vat_rate: string;
};

export type VatLine = { rate: string; baseHt: number; tvaAmount: number };

export type BillingTotals = {
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  vatLines: VatLine[];
};

/**
 * Half-up (away from zero) to the cent, like Python's ROUND_HALF_UP. `value * 100` is first
 * cut to 15 significant digits, so a float just under a half cent (1.005 * 100 is
 * 100.49999999999999) still rounds up the way the backend's Decimal does.
 */
export function round2(value: number): number {
  const cents = Number((Math.abs(value) * 100).toPrecision(15));
  return (Math.sign(value) * Math.round(cents)) / 100;
}
// Same parser as the editor's validation, so an amount the form accepts ("1 234,50") is the
// amount the live totals show rather than a silent zero.
const num = (value: string) => parseMoneyInput(String(value)) ?? 0;

export function lineTotalHt(item: TotalsItem): number {
  return round2(num(item.quantity) * num(item.unit_price));
}

export function computeBillingTotals(items: TotalsItem[]): BillingTotals {
  let totalHt = 0;
  const byRate = new Map<
    string,
    { rate: number; baseHt: number; tva: number }
  >();
  for (const item of items) {
    const ht = lineTotalHt(item);
    const rate = num(item.vat_rate);
    const tva = round2(ht * (rate / 100));
    totalHt = round2(totalHt + ht);
    const key = String(rate);
    const bucket = byRate.get(key) ?? { rate, baseHt: 0, tva: 0 };
    bucket.baseHt = round2(bucket.baseHt + ht);
    bucket.tva = round2(bucket.tva + tva);
    byRate.set(key, bucket);
  }
  const vatLines = [...byRate.values()]
    .sort((a, b) => b.rate - a.rate)
    .map((b) => ({ rate: String(b.rate), baseHt: b.baseHt, tvaAmount: b.tva }));
  const totalTva = round2(vatLines.reduce((sum, l) => sum + l.tvaAmount, 0));
  return { totalHt, totalTva, totalTtc: round2(totalHt + totalTva), vatLines };
}
