/** Live-preview totals for a billing document, same float algorithm as the web totals card. */

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

const round2 = (value: number) => Math.round(value * 100) / 100;
const num = (value: string) => {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

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
