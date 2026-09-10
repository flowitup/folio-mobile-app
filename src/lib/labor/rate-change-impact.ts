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
): number {
  return entries.filter((entry) => {
    const overridden =
      entry.amount_override !== null && entry.amount_override !== undefined;
    return (
      entry.worker_id === workerId &&
      entry.date >= effectiveDate &&
      entry.shift_type !== null &&
      entry.shift_type !== undefined &&
      entry.status !== "pending" &&
      !overridden
    );
  }).length;
}
