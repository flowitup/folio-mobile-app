import { invoiceTva } from "@/features/invoices/expense-cards";
import { invoiceTotals } from "@/lib/invoices/invoice-totals";

/**
 * The ledger row's VAT is the one the detail card and print page show (TTC − the lines' rounded
 * HT), not the exact Σ qty × price × vat, which could differ from it by a cent.
 */
describe("invoiceTva", () => {
  it("matches the detail split when the lines' HT carries sub-cents", () => {
    // Two 2.5 × 19.99 lines at 20 %: HT 49.98 each, TTC 59.97 each.
    const paint = { description: "Paint", quantity: 2.5, unit_price: 19.99, total: 59.97, vat_rate: 20 };
    expect(invoiceTva([paint, paint])).toBe(19.98);
    expect(invoiceTva([paint, paint])).toBe(invoiceTotals([paint, paint]).tva);
  });

  it("is 0 for lines without VAT and plain for whole amounts", () => {
    expect(invoiceTva([{ description: "Nail", quantity: 1, unit_price: 0.125, total: 0.13 }])).toBe(0);
    expect(
      invoiceTva([{ description: "Cement", quantity: 10, unit_price: 100, total: 1200, vat_rate: 20 }]),
    ).toBe(200);
  });
});
