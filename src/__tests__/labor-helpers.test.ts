import { buildMonthCells } from "../features/labor/calendar-month-grid";
import { buildBulkEntries } from "../features/labor/labor-sheets";

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
    const entries = buildBulkEntries(
      {
        a: { checked: true, shift_type: "full", supplement_hours: 2 },
        b: { checked: false, shift_type: "half", supplement_hours: 0 },
        c: { checked: true, shift_type: "overtime", supplement_hours: 0 },
      },
      "tag-1",
    );
    expect(entries).toEqual([
      {
        worker_id: "a",
        shift_type: "full",
        supplement_hours: 2,
        tag_id: "tag-1",
      },
      { worker_id: "c", shift_type: "overtime", tag_id: "tag-1" },
    ]);
  });
});
