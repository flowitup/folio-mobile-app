import type { Invoice } from "@/features/invoices/invoice-types";
import {
  groupInvoicesByMonth,
  ledgerTypeOf,
} from "@/lib/invoices/group-invoices-by-month";

const inv = (
  partial: Partial<Invoice> & Pick<Invoice, "id" | "type" | "total_amount">,
) =>
  ({
    issue_date: "2026-09-10",
    invoice_number: partial.id,
    ...partial,
  }) as Invoice;

const advance = inv({
  id: "adv",
  type: "released_funds",
  is_cash_advance: true,
  total_amount: 500,
});
const release = inv({ id: "rel", type: "released_funds", total_amount: 10000 });
const other = inv({ id: "oth", type: "others", total_amount: 40 });

describe("cash advances in the ledger", () => {
  it("files a cash-advance release under others, plain releases stay put", () => {
    expect(ledgerTypeOf(advance)).toBe("others");
    expect(ledgerTypeOf(release)).toBe("released_funds");
    expect(ledgerTypeOf(other)).toBe("others");
  });

  it("groups the advance in the month's others category", () => {
    const [month] = groupInvoicesByMonth([advance, release, other]);
    const byType = Object.fromEntries(month.categories.map((c) => [c.type, c]));
    expect(byType.released_funds.items.map((i) => i.id)).toEqual(["rel"]);
    expect(byType.others.items.map((i) => i.id).sort()).toEqual(["adv", "oth"]);
    expect(byType.others.subtotal).toBe(540);
  });

  it("keeps the advance out of the month's spend subtotal", () => {
    const [month] = groupInvoicesByMonth([advance, release, other]);
    expect(month.expenseSubtotal).toBe(40);
  });
});
