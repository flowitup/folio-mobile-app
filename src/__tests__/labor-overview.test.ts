import type { LaborPaymentsSummary } from "@/features/invoices/invoices-api";
import type {
  LaborSummaryResponse,
  MonthlySummaryRow,
} from "@/features/labor/labor-types";
import {
  availableYears,
  isPastMonth,
  monthDetail,
  monthSettlement,
  overviewMonths,
  rollupTotals,
  rowsInScope,
  scopeRange,
} from "@/lib/labor/labor-overview";

const ROWS: MonthlySummaryRow[] = [
  {
    year: 2026,
    month: 9,
    total_days: 3,
    total_cost: 450,
    workers: [
      { worker_id: "a", worker_name: "An", days_worked: 2, total_cost: 300 },
      { worker_id: "b", worker_name: "Binh", days_worked: 1, total_cost: 150 },
    ],
  },
  {
    year: 2025,
    month: 12,
    total_days: 1.5,
    total_cost: 225,
    workers: [
      { worker_id: "a", worker_name: "An", days_worked: 1.5, total_cost: 225 },
    ],
  },
];

const PAYMENTS = {
  months: [
    {
      year: 2026,
      month: 9,
      total_paid: 380,
      company_paid: 300,
      personal_paid: 80,
      unassigned_count: 1,
      unassigned_paid: 30,
      workers: [
        { worker_id: "a", worker_name: "An", paid: 350, invoice_count: 1 },
      ],
    },
    {
      year: null,
      month: null,
      total_paid: 10,
      company_paid: 0,
      personal_paid: 0,
      unassigned_count: 1,
      unassigned_paid: 10,
      workers: [],
    },
  ],
} as LaborPaymentsSummary;

const TODAY = new Date(2026, 8, 15);

describe("labor overview helpers", () => {
  it("maps a scope to the summary range", () => {
    expect(scopeRange({ kind: "all" })).toBeNull();
    expect(scopeRange({ kind: "year", year: 2025 })).toEqual({
      from: "2025-01-01",
      to: "2025-12-31",
    });
    expect(scopeRange({ kind: "month", month: "2026-02" })).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("lists years most recent first and filters rows by year", () => {
    expect(availableYears(ROWS)).toEqual([2026, 2025]);
    expect(rowsInScope(ROWS, { kind: "year", year: 2025 })).toHaveLength(1);
    expect(rowsInScope(ROWS, { kind: "all" })).toHaveLength(2);
  });

  it("settles worker by worker: one overpayment never hides another debt", () => {
    expect(monthSettlement(ROWS[0].workers, PAYMENTS.months[0])).toEqual({
      shortfall: 150,
      overpay: 50,
    });
    expect(monthSettlement(ROWS[0].workers, undefined)).toEqual({
      shortfall: 450,
      overpay: 0,
    });
  });

  it("warns unpaid on closed months only and overpaid on any month", () => {
    expect(isPastMonth(2026, 9, TODAY)).toBe(false);
    expect(isPastMonth(2025, 12, TODAY)).toBe(true);
    const [sept, dec] = overviewMonths(ROWS, PAYMENTS, TODAY);
    expect(sept.unpaidWarning).toBe(0);
    expect(sept.overpaidWarning).toBe(50);
    expect(sept.paid).toBe(380);
    expect(sept.unassignedCount).toBe(1);
    expect(dec.unpaidWarning).toBe(225);
    expect(dec.paid).toBe(0);
  });

  it("totals the visible months with distinct workers", () => {
    const totals = rollupTotals(overviewMonths(ROWS, PAYMENTS, TODAY));
    expect(totals).toEqual({
      cost: 675,
      days: 4.5,
      workerCount: 2,
      paid: 380,
      companyPaid: 300,
      personalPaid: 80,
    });
  });

  it("joins one month's workers with their payments; balance ignores unassigned", () => {
    const summary: LaborSummaryResponse = {
      rows: [
        {
          worker_id: "a",
          worker_name: "An",
          days_worked: 2,
          total_cost: 300,
          banked_hours: 0,
          bonus_full_days: 0,
          bonus_half_days: 0,
          bonus_cost: 0,
        },
        {
          worker_id: "b",
          worker_name: "Binh",
          days_worked: 1,
          total_cost: 150,
          banked_hours: 8,
          bonus_full_days: 1,
          bonus_half_days: 0,
          bonus_cost: 150,
        },
      ],
      total_days: 3,
      total_cost: 450,
      total_banked_hours: 8,
      total_bonus_days: 1,
      total_bonus_cost: 150,
    };
    const detail = monthDetail(summary, PAYMENTS, "2026-09");
    expect(detail.lines.map((l) => [l.workerId, l.paid, l.balance])).toEqual([
      ["a", 350, -50],
      ["b", 0, 150],
    ]);
    expect(detail.paid).toBe(350);
    expect(detail.balance).toBe(100);
    expect(detail.bonusCost).toBe(150);
  });
});
