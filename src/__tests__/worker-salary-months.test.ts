import type { Invoice } from "@/features/invoices/invoice-types";
import type { MonthlySummaryRow } from "@/features/labor/labor-types";
import {
  buildWorkerSalaryMonths,
  salaryTotals,
} from "@/lib/labor/worker-salary-months";

const rows: MonthlySummaryRow[] = [
  {
    year: 2026,
    month: 9,
    total_days: 3,
    total_cost: 450,
    workers: [
      {
        worker_id: "w1",
        worker_name: "Karin",
        days_worked: 2,
        total_cost: 300,
      },
      { worker_id: "w2", worker_name: "Ali", days_worked: 1, total_cost: 150 },
    ],
  },
  {
    year: 2026,
    month: 8,
    total_days: 4,
    total_cost: 600,
    workers: [
      {
        worker_id: "w1",
        worker_name: "Karin",
        days_worked: 4,
        total_cost: 600,
      },
    ],
  },
];
const inv = (id: string, amount: number, month: string, worker = "w1") =>
  ({
    id,
    type: "labor",
    total_amount: amount,
    service_month: `${month}-01`,
    worker_id: worker,
    issue_date: `${month}-15`,
  }) as Invoice;

describe("buildWorkerSalaryMonths", () => {
  it("joins earned and paid per month with a derived status", () => {
    const months = buildWorkerSalaryMonths(
      rows,
      [
        inv("a", 600, "2026-08"),
        inv("b", 100, "2026-09"),
        inv("c", 150, "2026-09", "w2"),
        inv("d", 50, "2026-07"),
      ],
      "w1",
    );
    expect(
      months.map((m) => [m.month, m.days, m.earned, m.paid, m.status]),
    ).toEqual([
      ["2026-09", 2, 300, 100, "partial"],
      ["2026-08", 4, 600, 600, "paid"],
      ["2026-07", 0, 0, 50, "overpaid"],
    ]);
    expect(months[0].invoices.map((i) => i.id)).toEqual(["b"]);
    expect(salaryTotals(months)).toEqual({
      earned: 900,
      paid: 750,
      remaining: 150,
    });
  });
  it("flags months with work but no payment as unpaid", () => {
    expect(buildWorkerSalaryMonths(rows, [], "w2")[0].status).toBe("unpaid");
  });
});
