import { computeBillingTotals, round2 } from "@/lib/billing/billing-totals";
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

  it("rounds each line half-up to the cent, as the saved document does", () => {
    // 1,5 × 33,33 = 49,995 → 50,00 HT, 10,00 TVA, 60,00 TTC on the form, the API and the PDF.
    const totals = computeBillingTotals([
      { quantity: "1,5", unit_price: "33,33", vat_rate: "20" },
    ]);
    expect(totals).toEqual(
      expect.objectContaining({ totalHt: 50, totalTva: 10, totalTtc: 60 }),
    );
    // 1 × 1,005 is 1.00499… as a float; the backend's Decimal rounds it to 1,01.
    expect(
      computeBillingTotals([
        { quantity: "1", unit_price: "1,005", vat_rate: "0" },
      ]).totalHt,
    ).toBe(1.01);
  });

  it("rounds a half cent away from zero in both signs", () => {
    expect(round2(0.125)).toBe(0.13);
    expect(round2(-0.125)).toBe(-0.13);
    expect(round2(2.675)).toBe(2.68);
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
