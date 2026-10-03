import type { Invoice } from "@/features/invoices/invoice-types";
import { buildPursesSummary } from "@/lib/invoices/expense-purses";

const inv = (
  partial: Partial<Invoice> & Pick<Invoice, "id" | "type" | "total_amount">,
) => ({ issue_date: "2026-09-01", ...partial }) as Invoice;

describe("buildPursesSummary", () => {
  it("splits purses, nets returns by type and counts pending channels", () => {
    const summary = buildPursesSummary([
      inv({ id: "a", type: "materials_services", total_amount: 100 }),
      inv({
        id: "b",
        type: "labor",
        total_amount: 50,
        paid_by_personal: true,
        refundable_status: "refundable",
      }),
      inv({
        id: "c",
        type: "return",
        total_amount: -20,
        refunds_invoice_id: "a",
        settled_via: "avoir",
      }),
      inv({ id: "d", type: "released_funds", total_amount: 500 }),
      inv({
        id: "e",
        type: "others",
        total_amount: 10,
        paid_by_personal: true,
        refundable_status: "refunded",
        refunded_by: "company",
      }),
    ]);
    expect(summary.company).toMatchObject({
      count: 2,
      spent: 90,
      returnsCount: 1,
      returnsTotal: -20,
    });
    expect(summary.company.types.materials_services.total).toBe(80);
    expect(summary.personal).toMatchObject({ count: 1, spent: 50 });
    expect(summary.refundable).toEqual({ count: 1, total: 50 });
    expect(summary.bankOutstanding).toEqual({ count: 2, total: 60 });
    expect(summary.outstandingAvoirs).toEqual({ count: 1, total: -20 });
    expect(summary.expenseCount).toBe(3);
  });

  it("keeps bank-only refunds personal and moves every company refund to the company purse", () => {
    // The bank-only refund is released to the personal purse, so its spend stays
    // there; anything the company reimbursed (with the bank or alone) is company spend.
    const refunded = (id: string, refunded_by: Invoice["refunded_by"], total_amount: number) =>
      inv({
        id,
        type: "materials_services",
        total_amount,
        paid_by_personal: true,
        refundable_status: "refunded",
        refunded_by,
      });
    const summary = buildPursesSummary([
      refunded("bank", "bank", 700),
      refunded("both", "both", 300),
      refunded("co", "company", 500),
    ]);
    expect(summary.personal).toMatchObject({ count: 1, spent: 700 });
    expect(summary.company).toMatchObject({ count: 2, spent: 800 });
    // The company still owes the bank-only refund; "both" and "company" are paid.
    expect(summary.refundable).toEqual({ count: 1, total: 700 });
  });
});
