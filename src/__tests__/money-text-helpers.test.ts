import { splitDigitGroups } from "@/components/ui/ink-sheet-screen";
import { businessToday, capitalizeFirst } from "@/lib/format/date";

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

describe("businessToday", () => {
  it("is the Paris calendar day, not the device's", () => {
    jest.useFakeTimers();
    // 31 Oct 19:30 in Paris is already 1 Nov 01:30 in Hanoi.
    jest.setSystemTime(new Date("2026-10-31T18:30:00Z"));
    try {
      expect(businessToday()).toBe("2026-10-31");
    } finally {
      jest.useRealTimers();
    }
  });
});
