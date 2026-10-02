import type { LaborPaymentsSummary } from "@/features/invoices/invoices-api";
import type {
  LaborSummaryResponse,
  MonthlySummaryRow,
} from "@/features/labor/labor-types";

/** One month of recorded labor payments (labor-payments-summary). */
export type PaymentsBucket = LaborPaymentsSummary["months"][number];

/** Overview scope: every month, one year of the monthly rollup, or one `YYYY-MM` month. */
export type OverviewScope =
  | { kind: "all" }
  | { kind: "year"; year: number }
  | { kind: "month"; month: string };

/** Differences under a cent are rounding, not money owed (same epsilon as the web). */
export const CENT = 0.01;

/** `YYYY-MM` key of a monthly row or payments bucket. */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Inclusive ISO day range the labor-summary endpoint takes for a scope; none for all history. */
export function scopeRange(
  scope: OverviewScope,
): { from: string; to: string } | null {
  if (scope.kind === "year")
    return { from: `${scope.year}-01-01`, to: `${scope.year}-12-31` };
  if (scope.kind === "month") {
    const [y, m] = scope.month.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return {
      from: `${scope.month}-01`,
      to: `${scope.month}-${String(last).padStart(2, "0")}`,
    };
  }
  return null;
}

/** Years that have labor in the monthly rollup, most recent first. */
export function availableYears(rows: readonly MonthlySummaryRow[]): number[] {
  return Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => b - a);
}

/** Monthly rows visible in a rollup scope (all history or one year). */
export function rowsInScope(
  rows: readonly MonthlySummaryRow[],
  scope: OverviewScope,
): MonthlySummaryRow[] {
  if (scope.kind === "year") return rows.filter((r) => r.year === scope.year);
  if (scope.kind === "month") return [];
  return [...rows];
}

/** Payments buckets keyed by `YYYY-MM` (buckets with no month are skipped). */
export function bucketsByMonth(
  payments: LaborPaymentsSummary | null | undefined,
): Map<string, PaymentsBucket> {
  const map = new Map<string, PaymentsBucket>();
  for (const b of payments?.months ?? []) {
    if (b.year != null && b.month != null)
      map.set(monthKey(b.year, b.month), b);
  }
  return map;
}

/**
 * Unpaid and overpaid amounts of one month, worker by worker — the back end's labor_unpaid
 * rule: one worker's overpayment never settles another worker's debt, and payments with no
 * worker settle nobody (the month shows those separately as "unassigned").
 */
export function monthSettlement(
  workers: readonly { worker_id: string; total_cost: number }[],
  bucket: PaymentsBucket | undefined | null,
): { shortfall: number; overpay: number } {
  const paidById = new Map<string, number>();
  for (const w of bucket?.workers ?? []) paidById.set(w.worker_id, w.paid);
  const costById = new Map<string, number>();
  for (const w of workers)
    costById.set(w.worker_id, (costById.get(w.worker_id) ?? 0) + w.total_cost);
  let shortfall = 0;
  let overpay = 0;
  for (const [id, cost] of costById) {
    const diff = cost - (paidById.get(id) ?? 0);
    if (diff > 0) shortfall += diff;
    else overpay -= diff;
  }
  // Paid workers with no cost that month are overpaid by all they received.
  for (const [id, paid] of paidById) {
    if (!costById.has(id) && paid > 0) overpay += paid;
  }
  return { shortfall, overpay };
}

/** A month before the current one: only closed months warn about unpaid labor. */
export function isPastMonth(
  year: number,
  month: number,
  today: Date = new Date(),
): boolean {
  return (
    year < today.getFullYear() ||
    (year === today.getFullYear() && month < today.getMonth() + 1)
  );
}

export type OverviewMonth = {
  key: string;
  row: MonthlySummaryRow;
  /** Every payment of the month, assigned or not (the money that actually left). */
  paid: number;
  companyPaid: number;
  personalPaid: number;
  unassignedCount: number;
  /** Shown on closed months only; mid-month unpaid is normal. */
  unpaidWarning: number;
  /** Shown on any month, current included: paying more than the charges is never normal. */
  overpaidWarning: number;
  paidByWorker: Map<string, number>;
};

/** Month cards of the rollup with their payments and settlement warnings. */
export function overviewMonths(
  rows: readonly MonthlySummaryRow[],
  payments: LaborPaymentsSummary | null | undefined,
  today: Date = new Date(),
): OverviewMonth[] {
  const buckets = bucketsByMonth(payments);
  return rows.map((row) => {
    const key = monthKey(row.year, row.month);
    const bucket = buckets.get(key);
    const { shortfall, overpay } = monthSettlement(row.workers, bucket);
    return {
      key,
      row,
      paid: bucket?.total_paid ?? 0,
      companyPaid: bucket?.company_paid ?? 0,
      personalPaid: bucket?.personal_paid ?? 0,
      unassignedCount: bucket?.unassigned_count ?? 0,
      unpaidWarning:
        isPastMonth(row.year, row.month, today) && shortfall > CENT
          ? shortfall
          : 0,
      overpaidWarning: overpay > CENT ? overpay : 0,
      paidByWorker: new Map(
        (bucket?.workers ?? []).map((w) => [w.worker_id, w.paid]),
      ),
    };
  });
}

export type RollupTotals = {
  cost: number;
  days: number;
  workerCount: number;
  paid: number;
  companyPaid: number;
  personalPaid: number;
};

/** Grand total of the visible months: distinct workers, and every payment of those months. */
export function rollupTotals(months: readonly OverviewMonth[]): RollupTotals {
  const workers = new Set<string>();
  const totals = months.reduce(
    (acc, m) => {
      m.row.workers.forEach((w) => workers.add(w.worker_id));
      acc.cost += m.row.total_cost;
      acc.days += m.row.total_days;
      acc.paid += m.paid;
      acc.companyPaid += m.companyPaid;
      acc.personalPaid += m.personalPaid;
      return acc;
    },
    { cost: 0, days: 0, paid: 0, companyPaid: 0, personalPaid: 0 },
  );
  return { ...totals, workerCount: workers.size };
}

export type WorkerMonthLine = {
  workerId: string;
  name: string;
  days: number;
  cost: number;
  paid: number;
  /** Cost minus paid; negative means the worker was overpaid. */
  balance: number;
  bankedHours: number;
  bonusFullDays: number;
  bonusHalfDays: number;
  bonusCost: number;
};

export type MonthDetail = {
  lines: WorkerMonthLine[];
  days: number;
  cost: number;
  /** Paid matched to the listed workers only — unassigned payments belong to nobody here. */
  paid: number;
  balance: number;
  bonusCost: number;
};

/** One month, worker by worker: the per-worker summary joined with that month's payments. */
export function monthDetail(
  summary: LaborSummaryResponse | null | undefined,
  payments: LaborPaymentsSummary | null | undefined,
  month: string,
): MonthDetail {
  const bucket = bucketsByMonth(payments).get(month);
  const paidById = new Map(
    (bucket?.workers ?? []).map((w) => [w.worker_id, w.paid]),
  );
  const lines = (summary?.rows ?? []).map((row) => {
    const paid = paidById.get(row.worker_id) ?? 0;
    return {
      workerId: row.worker_id,
      name: row.worker_name,
      days: row.days_worked,
      cost: row.total_cost,
      paid,
      balance: row.total_cost - paid,
      bankedHours: row.banked_hours,
      bonusFullDays: row.bonus_full_days,
      bonusHalfDays: row.bonus_half_days,
      bonusCost: row.bonus_cost,
    };
  });
  const cost = summary?.total_cost ?? 0;
  const paid = lines.reduce((sum, l) => sum + l.paid, 0);
  return {
    lines,
    days: summary?.total_days ?? 0,
    cost,
    paid,
    balance: cost - paid,
    bonusCost: summary?.total_bonus_cost ?? 0,
  };
}
