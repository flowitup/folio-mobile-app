import type { LaborEntry } from "@/features/labor/labor-types";

/**
 * Count the already-logged days whose cost a rate change takes over.
 *
 * The backend prices a day when it reads it, from the latest rate change whose
 * effective date is on or before that day, so every day logged from
 * `effectiveDate` onward follows the new rate — no re-entry needed. Three kinds
 * of row stay out of its reach: a manual amount override wins over the resolved
 * rate, a supplement-only row (no shift) is always priced at zero, and a
 * worker-submitted `pending` day carries no cost until a manager validates it
 * (it picks up the new rate then, so it is not a day being re-priced now).
 */
export function countRepricedDays(
  entries: LaborEntry[],
  workerId: string,
  effectiveDate: string,
  /** First day of the next later rate change, which takes over from there. */
  until?: string | null,
): number {
  return entries.filter((entry) => {
    const overridden =
      entry.amount_override !== null && entry.amount_override !== undefined;
    return (
      entry.worker_id === workerId &&
      entry.date >= effectiveDate &&
      (!until || entry.date < until) &&
      entry.shift_type !== null &&
      entry.shift_type !== undefined &&
      entry.status !== "pending" &&
      !overridden
    );
  }).length;
}

/**
 * The effective date of the first rate change after `effectiveDate`, or null.
 * Days from that date on keep following that later change, so a new change
 * only re-prices the days before it.
 */
export function nextRateChangeDate(
  changes: { effective_date: string }[],
  effectiveDate: string,
): string | null {
  let next: string | null = null;
  for (const change of changes) {
    if (
      change.effective_date > effectiveDate &&
      (next === null || change.effective_date < next)
    )
      next = change.effective_date;
  }
  return next;
}

/** The ISO day before `isoDate` ("2026-09-01" → "2026-08-31"). */
export function dayBefore(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
