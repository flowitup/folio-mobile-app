import {
  computeBudgetMeta,
  personalSpendRows,
} from "@/lib/projects/budget-display";

describe("budget display", () => {
  it("computes remaining, over-budget and clamped progress", () => {
    expect(computeBudgetMeta(1000, 200, 1200)).toMatchObject({
      remaining: -200,
      isOverBudget: true,
      progress: 1,
    });
    expect(computeBudgetMeta(0, 50, 10)).toMatchObject({
      isOverBudget: false,
      progress: 0,
    });
  });
  it("orders personal spend rows and drops zeros", () => {
    expect(
      personalSpendRows({
        others: 5,
        labor: 10,
        return: -2,
        custom: 1,
        materials_services: 0,
      }).map((r) => r.type),
    ).toEqual(["labor", "others", "return", "custom"]);
  });
});
