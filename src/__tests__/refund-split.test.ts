import { refundSplit } from "@/lib/invoices/refund-split";

describe("refundSplit", () => {
  // The QA data: 144 € of the refunded expenses were refunded by both sides.
  const summary = {
    refundable_amount: 284,
    refunded_total: 494,
    refunded_by_company: 314,
    refunded_by_bank: 324,
    refunded_by_both: 144,
  };

  it("totals the refund flows so the company and bank cards add up to it", () => {
    const split = refundSplit(summary);
    expect(split.totalFlows).toBe(
      summary.refunded_by_company + summary.refunded_by_bank,
    );
    expect(split.totalFlows).toBe(638);
  });

  it("splits the unique refunded total into company only, both and bank only", () => {
    // company only 170 / both 144 / bank only 180 of 494.
    expect(refundSplit(summary)).toEqual(
      expect.objectContaining({
        companyPercent: 34,
        bothPercent: 29,
        bankPercent: 37,
      }),
    );
  });

  it("reads zero shares when nothing was refunded", () => {
    expect(
      refundSplit({
        refundable_amount: 50,
        refunded_total: 0,
        refunded_by_company: 0,
        refunded_by_bank: 0,
        refunded_by_both: 0,
      }),
    ).toEqual({
      totalFlows: 0,
      companyPercent: 0,
      bothPercent: 0,
      bankPercent: 0,
    });
  });
});
