import type { Worker, WorkerRateChange } from "@/features/labor/labor-types";

/** One line of a worker's pay history, newest first. */
export type RateHistoryRow = {
  id: string;
  /** ISO date the rate took effect; null on the base row (the rate the worker was created with). */
  effectiveDate: string | null;
  rate: number;
  /** Difference from the rate in force just before this row; null on the base row. */
  delta: number | null;
  /** True when the rate change has not taken effect yet (effective date after `today`). */
  upcoming: boolean;
};

/** Newest → oldest, matching the backend list order (defensive: the API already sorts). */
function newestFirst(changes: WorkerRateChange[]): WorkerRateChange[] {
  return [...changes].sort((a, b) =>
    a.effective_date < b.effective_date
      ? 1
      : a.effective_date > b.effective_date
        ? -1
        : 0,
  );
}

/**
 * Build the pay history shown on the worker's profile: every rate change (newest first) with
 * the step from the previous rate, followed by the base rate the worker started with. The base
 * daily rate is the rate before the oldest change, so the oldest change's delta is measured
 * against it.
 */
export function buildRateHistory(
  changes: WorkerRateChange[],
  baseRate: number,
  today: string,
): RateHistoryRow[] {
  const sorted = newestFirst(changes);
  const rows: RateHistoryRow[] = sorted.map((change, index) => {
    const previous = sorted[index + 1]?.daily_rate ?? baseRate;
    return {
      id: change.id,
      effectiveDate: change.effective_date,
      rate: change.daily_rate,
      delta: change.daily_rate - previous,
      upcoming: change.effective_date > today,
    };
  });
  rows.push({
    id: "base",
    effectiveDate: null,
    rate: baseRate,
    delta: null,
    upcoming: false,
  });
  return rows;
}

/**
 * The rate in force today. Prefers the backend's `current_daily_rate` when it carries a real
 * amount (the API schema defaults the field to 0); otherwise resolves it from the changes
 * (latest effective on or before `today`), falling back to the base rate.
 */
export function currentDailyRate(
  worker: Pick<Worker, "daily_rate" | "current_daily_rate">,
  changes: WorkerRateChange[],
  today: string,
): number {
  if (
    typeof worker.current_daily_rate === "number" &&
    worker.current_daily_rate > 0
  )
    return worker.current_daily_rate;
  const effective = newestFirst(changes).find((c) => c.effective_date <= today);
  return effective?.daily_rate ?? worker.daily_rate;
}
