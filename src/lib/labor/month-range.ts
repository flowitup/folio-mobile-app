/** First and last ISO day of a `YYYY-MM` month (the attendance list/summary range). */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  return {
    from: `${month}-01`,
    to: `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`,
  };
}

/** Longest export span the app offers, in months. */
export const MAX_EXPORT_MONTHS = 24;

/** Inclusive number of months from `from` to `to`; 0 or less when `to` precedes `from`. */
export function monthSpan(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

/** A month range the export endpoint accepts: ordered and no longer than two years. */
export function isValidMonthRange(from: string, to: string): boolean {
  const span = monthSpan(from, to);
  return span >= 1 && span <= MAX_EXPORT_MONTHS;
}
