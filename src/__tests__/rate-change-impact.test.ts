import type { LaborEntry, ShiftType } from "@/features/labor/labor-types";
import {
  countRepricedDays,
  dayBefore,
  nextRateChangeDate,
} from "@/lib/labor/rate-change-impact";

const entry = (
  id: string,
  worker_id: string,
  date: string,
  extra: Partial<LaborEntry> = {},
): LaborEntry => ({
  id,
  worker_id,
  worker_name: "Worker",
  date,
  amount_override: null,
  effective_cost: 150,
  note: null,
  shift_type: "full" as ShiftType,
  supplement_hours: 0,
  created_at: "2026-01-01T00:00:00Z",
  ...extra,
});

const EFFECTIVE = "2026-06-01";

describe("countRepricedDays", () => {
  it("counts the worker's logged days on or after the effective date", () => {
    const entries = [
      entry("a", "w1", "2026-06-01"),
      entry("b", "w1", "2026-07-15"),
      entry("c", "w1", "2026-05-31"),
    ];
    expect(countRepricedDays(entries, "w1", EFFECTIVE)).toBe(2);
  });

  it("ignores other workers' days", () => {
    const entries = [
      entry("a", "w1", "2026-06-02"),
      entry("b", "w2", "2026-06-02"),
    ];
    expect(countRepricedDays(entries, "w1", EFFECTIVE)).toBe(1);
  });

  it("skips rows the rate cannot reach: manual override, supplement-only, pending", () => {
    const entries = [
      entry("kept", "w1", "2026-06-02"),
      entry("override", "w1", "2026-06-03", { amount_override: 200 }),
      entry("zero-override", "w1", "2026-06-04", { amount_override: 0 }),
      entry("supplement", "w1", "2026-06-05", { shift_type: null }),
      entry("pending", "w1", "2026-06-06", { status: "pending" }),
    ];
    expect(countRepricedDays(entries, "w1", EFFECTIVE)).toBe(1);
  });

  it("counts a validated day and a day with no status (older API rows)", () => {
    const entries = [
      entry("validated", "w1", "2026-06-02", { status: "validated" }),
      entry("legacy", "w1", "2026-06-03"),
    ];
    expect(countRepricedDays(entries, "w1", EFFECTIVE)).toBe(2);
  });

  it("counts half and overtime days, which scale off the same rate", () => {
    const entries = [
      entry("half", "w1", "2026-06-02", { shift_type: "half" }),
      entry("ot", "w1", "2026-06-03", { shift_type: "overtime" }),
    ];
    expect(countRepricedDays(entries, "w1", EFFECTIVE)).toBe(2);
  });

  it("returns zero when nothing is logged yet (a future-dated raise)", () => {
    expect(
      countRepricedDays([entry("a", "w1", "2026-06-02")], "w1", "2026-12-01"),
    ).toBe(0);
  });
});

describe("later rate changes", () => {
  it("stops counting at the next later rate change", () => {
    const entries = [
      entry("a", "w1", "2026-06-01"),
      entry("b", "w1", "2026-06-30"),
      entry("c", "w1", "2026-07-01"),
      entry("d", "w1", "2026-08-10"),
    ];
    expect(countRepricedDays(entries, "w1", EFFECTIVE, "2026-07-01")).toBe(2);
  });

  it("finds the first change after the picked date", () => {
    const changes = [
      { effective_date: "2026-09-01" },
      { effective_date: "2026-05-01" },
      { effective_date: "2026-07-01" },
    ];
    expect(nextRateChangeDate(changes, EFFECTIVE)).toBe("2026-07-01");
    expect(nextRateChangeDate(changes, "2026-09-01")).toBeNull();
  });

  it("steps back one day across a month boundary", () => {
    expect(dayBefore("2026-03-01")).toBe("2026-02-28");
  });
});
