import type { Invoice } from "@/features/invoices/invoice-types";
import type { Task } from "@/features/tasks/tasks-api";
import {
  buildDrawSeries,
  computeBankReleaseMetrics,
} from "@/lib/dashboard/bank-release-metrics";
import { groupAgendaTasks } from "@/lib/dashboard/overview-agenda";
import {
  buildMonthlySpendSeries,
  buildTypeMonthlyBuckets,
  computeBudgetMetrics,
  computePendingRefunds,
  computeSpentTotal,
} from "@/lib/dashboard/overview-metrics";

const inv = (
  partial: Partial<Invoice> &
    Pick<Invoice, "id" | "type" | "total_amount" | "issue_date">,
) => ({ invoice_number: partial.id, ...partial }) as Invoice;

const REF = new Date(2026, 8, 4); // 4 Sep 2026

const invoices: Invoice[] = [
  inv({
    id: "a",
    type: "materials_services",
    total_amount: 100,
    issue_date: "2026-09-01",
  }),
  inv({
    id: "b",
    type: "labor",
    total_amount: 50,
    issue_date: "2026-07-20",
    service_month: "2026-08-01",
  }),
  inv({
    id: "c",
    type: "return",
    total_amount: -30,
    issue_date: "2026-09-02",
    refunds_invoice_id: "a",
  }),
  inv({
    id: "d",
    type: "released_funds",
    total_amount: 500,
    issue_date: "2026-06-10",
  }),
  inv({
    id: "e",
    type: "materials_services",
    total_amount: 40,
    issue_date: "2026-08-15",
    paid_by_personal: true,
    refundable_status: "refundable",
  }),
];

describe("overview metrics", () => {
  it("nets returns into their own month and type", () => {
    expect(computeSpentTotal(invoices)).toBe(160);
    const series = buildMonthlySpendSeries(invoices, 6, REF);
    expect(series).toHaveLength(6);
    const sep = series[5];
    expect(sep).toMatchObject({
      key: "2026-09",
      total: 70,
      count: 1,
      credited: -30,
      creditCount: 1,
    });
    expect(series[4]).toMatchObject({ key: "2026-08", total: 90, count: 2 });
    const buckets = buildTypeMonthlyBuckets(invoices, 6, REF);
    expect(buckets.find((b) => b.type === "materials_services")?.total).toBe(
      110,
    );
    expect(buckets.find((b) => b.type === "labor")?.monthly[4].total).toBe(50);
  });

  it("computes budget and pending refunds", () => {
    expect(computeBudgetMetrics(1000, 160, 500)).toMatchObject({
      left: 840,
      pct: 16,
      usesBudget: true,
    });
    expect(computeBudgetMetrics(null, 160, 500)).toMatchObject({
      denominator: 500,
      pct: 32,
    });
    expect(computePendingRefunds(invoices)).toEqual({ count: 1, total: 40 });
  });

  it("builds the draw ledger", () => {
    expect(computeBankReleaseMetrics(1000, 500)).toMatchObject({
      remaining: 500,
      pct: 50,
    });
    expect(buildDrawSeries(invoices).last?.id).toBe("d");
  });
});

describe("agenda grouping", () => {
  const task = (id: string, due: string | null, status = "todo") =>
    ({ id, due_date: due, status, position: 0 }) as unknown as Task;
  it("groups overdue / today / this week within the caps", () => {
    const groups = groupAgendaTasks(
      [
        task("1", "2026-09-01"),
        task("2", "2026-09-04"),
        task("3", "2026-09-06"),
        task("4", "2026-09-20"),
        task("5", "2026-09-03", "done"),
        task("6", null),
      ],
      new Date(2026, 8, 4),
    );
    expect(groups.map((g) => [g.key, g.tasks.map((t) => t.id)])).toEqual([
      ["overdue", ["1"]],
      ["today", ["2"]],
      ["thisWeek", ["3"]],
    ]);
  });
});
