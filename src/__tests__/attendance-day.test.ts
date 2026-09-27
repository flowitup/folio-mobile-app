import {
  SELF_ATTENDANCE_MAX_BACKDATE_DAYS,
  canSelfLogDay,
  dayInMonth,
  defaultDayOfMonth,
  earliestSelfLogDay,
} from "@/lib/labor/attendance-day";

const TODAY = "2026-09-21";

describe("dayInMonth", () => {
  it("keeps a day that belongs to the viewed month", () => {
    expect(dayInMonth("2026-09-04", "2026-09", TODAY)).toBe("2026-09-04");
  });

  it("falls back to today while the current month is viewed", () => {
    expect(dayInMonth("2026-08-04", "2026-09", TODAY)).toBe(TODAY);
    expect(dayInMonth(null, "2026-09", TODAY)).toBe(TODAY);
  });

  it("falls back to the 1st of any other month", () => {
    expect(dayInMonth(TODAY, "2026-08", TODAY)).toBe("2026-08-01");
    expect(dayInMonth("2026-09-04", "2026-11", TODAY)).toBe("2026-11-01");
    expect(defaultDayOfMonth("2026-12", TODAY)).toBe("2026-12-01");
  });
});

describe("self-log window", () => {
  it("reaches exactly 31 days back, inclusive", () => {
    expect(SELF_ATTENDANCE_MAX_BACKDATE_DAYS).toBe(31);
    expect(earliestSelfLogDay(TODAY)).toBe("2026-08-21");
    expect(canSelfLogDay("2026-08-21", TODAY)).toBe(true);
    expect(canSelfLogDay("2026-08-20", TODAY)).toBe(false);
  });

  it("accepts today and refuses tomorrow", () => {
    expect(canSelfLogDay(TODAY, TODAY)).toBe(true);
    expect(canSelfLogDay("2026-09-22", TODAY)).toBe(false);
  });

  it("crosses a month and a year boundary", () => {
    expect(earliestSelfLogDay("2026-01-05")).toBe("2025-12-05");
    expect(canSelfLogDay("2025-12-31", "2026-01-05")).toBe(true);
    expect(canSelfLogDay("2025-12-04", "2026-01-05")).toBe(false);
  });
});
