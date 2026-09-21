import { buildMonthCells } from "../features/labor/calendar-month-grid";
import { buildBulkEntries } from "../features/labor/labor-sheets";
import { isValidMonthRange, monthSpan } from "@/lib/labor/month-range";

describe("buildMonthCells", () => {
  it("starts on Monday, pads to full weeks and lists every day of the month", () => {
    const cells = buildMonthCells("2026-09"); // 1 Sept 2026 is a Tuesday
    expect(cells.length % 7).toBe(0);
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBe("2026-09-01");
    expect(cells.filter(Boolean)).toHaveLength(30);
    expect(cells.filter(Boolean).pop()).toBe("2026-09-30");
  });
});

describe("buildBulkEntries", () => {
  it("emits only checked tiles, with supplement and tag when set", () => {
    const entries = buildBulkEntries({
      a: { checked: true, shift_type: "full", supplement_hours: 2 },
      b: { checked: false, shift_type: "half", supplement_hours: 0 },
      c: { checked: true, shift_type: "overtime", supplement_hours: 0 },
    });
    expect(entries).toEqual([
      { worker_id: "a", shift_type: "full", supplement_hours: 2 },
      { worker_id: "c", shift_type: "overtime" },
    ]);
  });
});

describe("month range", () => {
  it("counts the span inclusively, across years", () => {
    expect(monthSpan("2026-09", "2026-09")).toBe(1);
    expect(monthSpan("2025-12", "2026-01")).toBe(2);
    expect(monthSpan("2026-09", "2026-08")).toBe(0);
  });

  it("accepts an ordered range of at most 24 months", () => {
    expect(isValidMonthRange("2026-09", "2026-09")).toBe(true);
    expect(isValidMonthRange("2025-01", "2026-12")).toBe(true);
    expect(isValidMonthRange("2024-12", "2026-12")).toBe(false);
    expect(isValidMonthRange("2026-09", "2026-08")).toBe(false);
  });
});
