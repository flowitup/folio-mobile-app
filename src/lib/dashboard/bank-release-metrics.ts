/** Credit − drawn helpers for the bank release card, copied from the web helper. */
import type { Invoice } from "@/features/invoices/invoice-types";

export interface BankReleaseMetrics {
  credit: number;
  released: number;
  remaining: number;
  hasCredit: boolean;
  pct: number;
  pctClamped: number;
}

export function computeBankReleaseMetrics(
  credit: number | null | undefined,
  releasedTotal: number,
): BankReleaseMetrics {
  const hasCredit = typeof credit === "number" && credit > 0;
  const creditValue = hasCredit ? (credit as number) : 0;
  const pct = hasCredit ? Math.round((releasedTotal / creditValue) * 100) : 0;
  return {
    credit: creditValue,
    released: releasedTotal,
    remaining: creditValue - releasedTotal,
    hasCredit,
    pct,
    pctClamped: Math.min(Math.max(pct, 0), 100),
  };
}

export interface BankDraw {
  id: string;
  number: string;
  date: string;
  amount: number;
}

export interface DrawSeries {
  draws: BankDraw[];
  totalDrawn: number;
  largest: BankDraw | null;
  last: BankDraw | null;
}

/** Draws attribute to `issue_date` (the day the bank moved the money), never `service_month`. */
export function buildDrawSeries(invoices: Invoice[]): DrawSeries {
  const draws: BankDraw[] = invoices
    .filter((inv) => inv.type === "released_funds")
    .map((inv) => ({
      id: inv.id,
      number: inv.invoice_number,
      date: inv.issue_date,
      amount: inv.total_amount,
    }))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.number.localeCompare(b.number),
    );

  let totalDrawn = 0;
  let largest: BankDraw | null = null;
  for (const draw of draws) {
    totalDrawn += draw.amount;
    if (!largest || draw.amount > largest.amount) largest = draw;
  }
  return {
    draws,
    totalDrawn,
    largest,
    last: draws.length > 0 ? draws[draws.length - 1] : null,
  };
}
