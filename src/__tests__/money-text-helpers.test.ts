import { splitDigitGroups } from "@/components/ui/ink-sheet-screen";
import { capitalizeFirst } from "@/lib/format/date";

describe("capitalizeFirst", () => {
  it("upper-cases the first letter only (vi months stay 'Tháng 9 năm 2026')", () => {
    expect(capitalizeFirst("tháng 9 năm 2026")).toBe("Tháng 9 năm 2026");
    expect(capitalizeFirst("septembre 2026")).toBe("Septembre 2026");
    expect(capitalizeFirst("")).toBe("");
  });
});

describe("splitDigitGroups", () => {
  it("isolates the spaces between digit groups so they can be drawn narrow", () => {
    // fr-FR groups with U+202F and puts U+00A0 before the euro sign.
    const parts = splitDigitGroups("11 420 €");
    expect(parts).toEqual([
      { text: "11", gap: false },
      { text: " ", gap: true },
      { text: "420 €", gap: false },
    ]);
    expect(parts.map((part) => part.text).join("")).toBe("11 420 €");
  });

  it("leaves a figure without grouping whole", () => {
    expect(splitDigitGroups("€420")).toEqual([{ text: "€420", gap: false }]);
  });
});
