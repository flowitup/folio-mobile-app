/**
 * Closed labor months ("Chốt tháng", owner decision QĐ-10).
 *
 * A closed month is a marker, not a lock: every write into it still saves, after an in-app
 * "Month X is closed. Save anyway?", and the API records who changed what. These helpers
 * decide which closed months a write touches and what the close checklist shows.
 */

type HasMonth = { month: string };

/** `YYYY-MM` of a `YYYY-MM-DD` day or a `YYYY-MM` month; null for anything else. */
export function monthKeyOf(value: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?/.exec(value ?? "");
  return match ? `${match[1]}-${match[2]}` : null;
}

/** The closed months (sorted `YYYY-MM`) among the days or months a write touches. */
export function closedMonthsFor(
  closures: readonly HasMonth[],
  daysOrMonths: readonly (string | null | undefined)[],
): string[] {
  const closed = new Set(closures.map((c) => c.month));
  const hit = new Set<string>();
  for (const value of daysOrMonths) {
    const key = monthKeyOf(value);
    if (key && closed.has(key)) hit.add(key);
  }
  return [...hit].sort();
}

/** The closure of `month`, if that month is closed. */
export function closureFor<T extends HasMonth>(
  closures: readonly T[] | null | undefined,
  month: string,
): T | undefined {
  return (closures ?? []).find((c) => c.month === month);
}

export type CloseChecklist = {
  /** Days of the month still waiting for validation. */
  pendingDays: number;
  /** Labor payments of the month with no worker, plus every labor payment with no month. */
  unsettledPayments: number;
  /** Still owed to the month's workers (positive balances only). */
  owed: number;
  /** Something above is still loose: closing is allowed, but worth a second look. */
  loose: boolean;
};

type PaymentBucket = {
  year: number | null;
  month: number | null;
  unassigned_count: number;
  workers: { invoice_count: number }[];
};

/** What the "Close month" confirmation lists before a manager closes `month`. */
export function closeChecklist({
  month,
  entries,
  payments,
  owed,
}: {
  month: string;
  entries: readonly { date: string; status?: string | null }[];
  payments: { months: readonly PaymentBucket[] } | null | undefined;
  owed: number;
}): CloseChecklist {
  const pendingDays = entries.filter(
    (e) => e.status === "pending" && monthKeyOf(e.date) === month,
  ).length;
  let unsettledPayments = 0;
  for (const bucket of payments?.months ?? []) {
    if (bucket.year == null || bucket.month == null)
      unsettledPayments +=
        bucket.unassigned_count +
        bucket.workers.reduce((n, w) => n + w.invoice_count, 0);
    else if (
      `${bucket.year}-${String(bucket.month).padStart(2, "0")}` === month
    )
      unsettledPayments += bucket.unassigned_count;
  }
  const owedAmount = Math.max(0, owed);
  return {
    pendingDays,
    unsettledPayments,
    owed: owedAmount,
    loose: pendingDays > 0 || unsettledPayments > 0 || owedAmount > 0.005,
  };
}
