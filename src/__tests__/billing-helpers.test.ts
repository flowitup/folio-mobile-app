import { computeBillingTotals } from "@/lib/billing/billing-totals";
import {
  allowedTransitions,
  statusTone,
  transitionLabelKey,
} from "@/lib/billing/billing-status-transitions";

describe("computeBillingTotals", () => {
  it("sums lines and breaks VAT down per rate, highest rate first", () => {
    const totals = computeBillingTotals([
      { quantity: "2", unit_price: "100", vat_rate: "20" },
      { quantity: "1", unit_price: "50,5", vat_rate: "10" },
      { quantity: "3", unit_price: "10", vat_rate: "20" },
    ]);
    expect(totals.totalHt).toBe(280.5);
    expect(totals.vatLines).toEqual([
      { rate: "20", baseHt: 230, tvaAmount: 46 },
      { rate: "10", baseHt: 50.5, tvaAmount: 5.05 },
    ]);
    expect(totals.totalTva).toBe(51.05);
    expect(totals.totalTtc).toBe(331.55);
  });

  it("treats unparsable numbers as zero", () => {
    expect(
      computeBillingTotals([
        { quantity: "x", unit_price: "10", vat_rate: "20" },
      ]).totalTtc,
    ).toBe(0);
  });
});

describe("status transitions", () => {
  it("follows the devis matrix", () => {
    expect(allowedTransitions("devis", "sent")).toEqual([
      "accepted",
      "rejected",
      "expired",
    ]);
    expect(allowedTransitions("devis", "expired")).toEqual([]);
    expect(transitionLabelKey("devis", "accepted", "sent")).toBe(
      "revertToSent",
    );
    expect(transitionLabelKey("devis", "rejected", "draft")).toBe("reopen");
  });

  it("follows the facture matrix", () => {
    expect(allowedTransitions("facture", "paid")).toEqual(["cancelled"]);
    expect(transitionLabelKey("facture", "paid", "cancelled")).toBe(
      "markAsCancelledRefund",
    );
    expect(transitionLabelKey("facture", "sent", "paid")).toBe("markAsPaid");
    expect(statusTone("overdue")).toBe("danger");
  });
});
