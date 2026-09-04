/**
 * Per-worker salary ledger: one row per month joining what attendance earned
 * (labor-monthly-summary) with what was paid (labor invoices carrying `worker_id` + `service_month`).
 * "Paid" is derived, never stored: a month is paid when its payments cover the earned amount.
 */
import type { Invoice } from "@/features/invoices/invoice-types";
import type { MonthlySummaryRow } from "@/features/labor/labor-types";

export type SalaryStatus = "paid" | "partial" | "unpaid" | "overpaid" | "none";

export interface SalaryMonth {
  /** "YYYY-MM" */
  month: string;
  days: number;
  earned: number;
  paid: number;
  remaining: number;
  status: SalaryStatus;
  invoices: Invoice[];
}

export interface SalaryTotals {
  earned: number;
  paid: number;
  remaining: number;
}

const monthKey = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;
const round2 = (value: number) => Math.round(value * 100) / 100;

export function salaryStatus(earned: number, paid: number): SalaryStatus {
  if (earned <= 0 && paid <= 0) return "none";
  if (paid <= 0) return "unpaid";
  if (round2(paid) < round2(earned)) return "partial";
  if (round2(paid) > round2(earned)) return "overpaid";
  return "paid";
}

export function buildWorkerSalaryMonths(
  rows: MonthlySummaryRow[],
  laborInvoices: Invoice[],
  workerId: string,
): SalaryMonth[] {
  const byMonth = new Map<string, SalaryMonth>();
  const bucket = (month: string) => {
    const existing = byMonth.get(month);
    if (existing) return existing;
    const fresh: SalaryMonth = {
      month,
      days: 0,
      earned: 0,
      paid: 0,
      remaining: 0,
      status: "none",
      invoices: [],
    };
    byMonth.set(month, fresh);
    return fresh;
  };
  for (const row of rows) {
    const sub = row.workers.find((w) => w.worker_id === workerId);
    if (!sub) continue;
    const entry = bucket(monthKey(row.year, row.month));
    entry.days += sub.days_worked;
    entry.earned = round2(entry.earned + sub.total_cost);
  }
  for (const inv of laborInvoices) {
    if (
      inv.type !== "labor" ||
      inv.worker_id !== workerId ||
      !inv.service_month
    )
      continue;
    const entry = bucket(inv.service_month.slice(0, 7));
    entry.paid = round2(entry.paid + inv.total_amount);
    entry.invoices.push(inv);
  }
  return [...byMonth.values()]
    .map((entry) => ({
      ...entry,
      remaining: round2(entry.earned - entry.paid),
      status: salaryStatus(entry.earned, entry.paid),
      invoices: [...entry.invoices].sort((a, b) =>
        b.issue_date.localeCompare(a.issue_date),
      ),
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

export function salaryTotals(months: SalaryMonth[]): SalaryTotals {
  const earned = round2(months.reduce((s, m) => s + m.earned, 0));
  const paid = round2(months.reduce((s, m) => s + m.paid, 0));
  return { earned, paid, remaining: round2(earned - paid) };
}
