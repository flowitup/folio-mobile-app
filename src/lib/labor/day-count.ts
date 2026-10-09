/**
 * A number of days as the labor screens show it, and the count its unit agrees with.
 * The count is the value as shown (rounded to the same decimals), so a 0.999 that reads
 * "1" says "1 day", and fractions follow each locale's plural rule ("0,5 jour").
 */
export function dayCount(value: number, maximumFractionDigits = 2): number {
  const factor = 10 ** maximumFractionDigits;
  return Math.round(value * factor) / factor;
}
