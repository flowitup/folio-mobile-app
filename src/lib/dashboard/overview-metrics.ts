/**
 * Pure aggregation helpers for the dashboard overview, copied from the web
 * `lib/dashboard/overview-metrics.ts`. Spend is NET of returns: a return is attributed to
 * its own issue month and to the type of the invoice it refunds (materials_services when
 * unlinked). `released_funds` rows are never spend.
 */
import type { Invoice, InvoiceType } from "@/features/invoices/invoice-types";

export type ExpenseType = Extract<
  InvoiceType,
  "labor" | "materials_services" | "others"
>;
export const EXPENSE_TYPES: readonly ExpenseType[] = [
  "labor",
  "materials_services",
  "others",
];

function isSpendInvoice(inv: Invoice): boolean {
  return (
    inv.type === "labor" ||
    inv.type === "materials_services" ||
    inv.type === "others"
  );
}

function isExpenseType(t: InvoiceType | undefined): t is ExpenseType {
  return t === "labor" || t === "materials_services" || t === "others";
}

/** A personally-paid expense the company already reimbursed counts as company money. */
export function isPersonalExpense(inv: Invoice): boolean {
  return (
    Boolean(inv.paid_by_personal) &&
    !(inv.refundable_status === "refunded" && inv.refunded_by !== "bank")
  );
}

function monthKeyOf(inv: Invoice): string {
  return (inv.service_month ?? inv.issue_date).slice(0, 7);
}

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthKeyToDate(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

export interface ReturnCredit {
  type: ExpenseType;
  monthKey: string;
  /** Negative, straight from the return invoice. */
  amount: number;
}

export function buildReturnCredits(invoices: Invoice[]): ReturnCredit[] {
  const typeById = new Map(invoices.map((i) => [i.id, i.type]));
  const credits: ReturnCredit[] = [];
  for (const inv of invoices) {
    if (inv.type !== "return") continue;
    const sourceType = inv.refunds_invoice_id
      ? typeById.get(inv.refunds_invoice_id)
      : undefined;
    credits.push({
      type: isExpenseType(sourceType) ? sourceType : "materials_services",
      monthKey: monthKeyOf(inv),
      amount: inv.total_amount,
    });
  }
  return credits;
}

export function computeSpentTotal(invoices: Invoice[]): number {
  const spend = invoices
    .filter(isSpendInvoice)
    .reduce((s, i) => s + i.total_amount, 0);
  return buildReturnCredits(invoices).reduce((s, c) => s + c.amount, spend);
}

export interface MonthlySpendPoint {
  key: string;
  total: number;
  count: number;
  credited: number;
  creditCount: number;
}

export function buildMonthlySpendSeries(
  invoices: Invoice[],
  months = 6,
  referenceDate: Date = new Date(),
  credits: ReturnCredit[] = buildReturnCredits(invoices),
): MonthlySpendPoint[] {
  const byMonth = new Map<string, Omit<MonthlySpendPoint, "key">>();
  const bucketFor = (key: string) => {
    const existing = byMonth.get(key);
    if (existing) return existing;
    const fresh = { total: 0, count: 0, credited: 0, creditCount: 0 };
    byMonth.set(key, fresh);
    return fresh;
  };
  for (const inv of invoices) {
    if (!isSpendInvoice(inv)) continue;
    const bucket = bucketFor(monthKeyOf(inv));
    bucket.total += inv.total_amount;
    bucket.count += 1;
  }
  for (const credit of credits) {
    const bucket = bucketFor(credit.monthKey);
    bucket.total += credit.amount;
    bucket.credited += credit.amount;
    bucket.creditCount += 1;
  }
  const anchor = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    1,
  );
  const series: MonthlySpendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    const key = ymKey(d);
    const bucket = byMonth.get(key);
    series.push({
      key,
      total: bucket?.total ?? 0,
      count: bucket?.count ?? 0,
      credited: bucket?.credited ?? 0,
      creditCount: bucket?.creditCount ?? 0,
    });
  }
  return series;
}

export interface MonthDelta {
  current: MonthlySpendPoint;
  previous: MonthlySpendPoint | null;
  deltaPct: number | null;
}

export function computeMonthDelta(series: MonthlySpendPoint[]): MonthDelta {
  const current = series[series.length - 1];
  const previous = series[series.length - 2] ?? null;
  const deltaPct =
    previous && previous.total > 0
      ? Math.round(((current.total - previous.total) / previous.total) * 100)
      : null;
  return { current, previous, deltaPct };
}

export interface BudgetMetrics {
  denominator: number;
  usesBudget: boolean;
  left: number;
  pct: number;
  pctClamped: number;
}

export function computeBudgetMetrics(
  budget: number | null | undefined,
  spentTotal: number,
  fundsReleasedTotal: number,
): BudgetMetrics {
  const usesBudget = typeof budget === "number" && budget > 0;
  const denominator = usesBudget ? budget : fundsReleasedTotal;
  const left = denominator - spentTotal;
  const pct =
    denominator > 0 ? Math.round((spentTotal / denominator) * 100) : 0;
  return {
    denominator,
    usesBudget,
    left,
    pct,
    pctClamped: Math.min(Math.max(pct, 0), 100),
  };
}

export interface PendingRefunds {
  count: number;
  total: number;
}

/** Expenses the BANK still owes back; overlaps computePendingRefunds — never sum the two. */
export function computeBankOutstanding(invoices: Invoice[]): PendingRefunds {
  let count = 0;
  let total = 0;
  for (const inv of invoices) {
    if (!isSpendInvoice(inv)) continue;
    if (!inv.refundable_status) continue;
    if (inv.refunded_by === "bank" || inv.refunded_by === "both") continue;
    count += 1;
    total += inv.total_amount;
  }
  return { count, total };
}

/** Personal expenses still awaiting company reimbursement. */
export function computePendingRefunds(invoices: Invoice[]): PendingRefunds {
  let count = 0;
  let total = 0;
  for (const inv of invoices) {
    if (!isSpendInvoice(inv)) continue;
    if (!isPersonalExpense(inv)) continue;
    if (
      inv.refundable_status === "refundable" ||
      inv.refundable_status === "refund_pending"
    ) {
      count += 1;
      total += inv.total_amount;
    }
  }
  return { count, total };
}

export interface MoneyPurseView {
  key: "company" | "personal";
  released: number;
  spent: number;
  count: number;
}

export interface InvoiceMetaLike {
  fundsReleasedTotal: number;
  fundsReleasedCompanyTotal?: number;
  fundsReleasedPersonalTotal?: number;
  companySpentTotal: number;
  personalSpentTotal?: number;
}

export function buildPurseViews(
  invoices: Invoice[],
  meta: InvoiceMetaLike,
): MoneyPurseView[] {
  let companyCount = 0;
  let personalCount = 0;
  for (const inv of invoices) {
    if (!isSpendInvoice(inv)) continue;
    if (isPersonalExpense(inv)) personalCount += 1;
    else companyCount += 1;
  }
  const releasedPersonal = meta.fundsReleasedPersonalTotal ?? 0;
  const releasedCompany =
    meta.fundsReleasedCompanyTotal ??
    meta.fundsReleasedTotal - releasedPersonal;
  return [
    {
      key: "company",
      released: releasedCompany,
      spent: meta.companySpentTotal,
      count: companyCount,
    },
    {
      key: "personal",
      released: releasedPersonal,
      spent: meta.personalSpentTotal ?? 0,
      count: personalCount,
    },
  ];
}

export interface TypeMonthlyBucket {
  type: ExpenseType;
  monthly: MonthlySpendPoint[];
  total: number;
  count: number;
  deltaPct: number | null;
}

export function buildTypeMonthlyBuckets(
  invoices: Invoice[],
  months = 6,
  referenceDate: Date = new Date(),
): TypeMonthlyBucket[] {
  const credits = buildReturnCredits(invoices);
  return EXPENSE_TYPES.map((type) => {
    const monthly = buildMonthlySpendSeries(
      invoices.filter((i) => i.type === type),
      months,
      referenceDate,
      credits.filter((c) => c.type === type),
    );
    const total = monthly.reduce((s, m) => s + m.total, 0);
    const count = monthly.reduce((s, m) => s + m.count, 0);
    const { deltaPct } = computeMonthDelta(monthly);
    return { type, monthly, total, count, deltaPct };
  });
}

export function sharedMonthlyMax(buckets: TypeMonthlyBucket[]): number {
  const max = buckets.reduce(
    (m, b) => Math.max(m, ...b.monthly.map((p) => p.total)),
    0,
  );
  return max > 0 ? max : 1;
}
