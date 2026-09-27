import type { RefundableSummary } from "@/features/invoices/invoice-types";

export type RefundSplit = {
  /** Total of refund flows: company + bank, so an expense refunded by both counts twice. */
  totalFlows: number;
  companyPercent: number;
  bothPercent: number;
  bankPercent: number;
};

/** Round part/whole to a whole display percent (0 when whole is 0). */
function toPercent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * Same reading of the refund summary as the web cards. The company and bank figures are
 * involvement figures (an expense refunded by both counts in full in each), so the total
 * card shows their sum, and the bar splits the unique refunded total into three exclusive
 * parts: company only, both, bank only. The last part is the complement, so the three
 * labels always add up to 100%.
 */
export function refundSplit(summary: RefundableSummary): RefundSplit {
  const both = summary.refunded_by_both ?? 0;
  const whole = summary.refunded_total;
  const companyPercent = toPercent(summary.refunded_by_company - both, whole);
  const bothPercent = toPercent(both, whole);
  return {
    totalFlows: summary.refunded_by_company + summary.refunded_by_bank,
    companyPercent,
    bothPercent,
    bankPercent: whole > 0 ? 100 - companyPercent - bothPercent : 0,
  };
}
