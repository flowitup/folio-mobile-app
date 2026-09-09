import type { WorkerRateChange } from "@/features/labor/labor-types";
import { buildRateHistory, currentDailyRate } from "@/lib/labor/rate-history";

const change = (
  id: string,
  effective_date: string,
  daily_rate: number,
): WorkerRateChange => ({
  id,
  worker_id: "w1",
  effective_date,
  daily_rate,
  created_at: "2026-01-01T00:00:00Z",
});

const TODAY = "2026-09-09";

describe("buildRateHistory", () => {
  it("returns only the base row when nothing changed", () => {
    expect(buildRateHistory([], 150, TODAY)).toEqual([
      {
        id: "base",
        effectiveDate: null,
        rate: 150,
        delta: null,
        upcoming: false,
      },
    ]);
  });

  it("lists changes newest first with the step from the previous rate, base row last", () => {
    const rows = buildRateHistory(
      [
        change("a", "2026-03-01", 160),
        change("c", "2026-09-01", 175),
        change("b", "2026-06-01", 170),
      ],
      150,
      TODAY,
    );
    expect(rows.map((r) => [r.id, r.rate, r.delta])).toEqual([
      ["c", 175, 5],
      ["b", 170, 10],
      ["a", 160, 10],
      ["base", 150, null],
    ]);
    expect(rows.every((r) => !r.upcoming)).toBe(true);
  });

  it("keeps a decrease as a negative delta and flags a future-dated change", () => {
    const rows = buildRateHistory(
      [change("cut", "2026-10-01", 140), change("up", "2026-02-01", 160)],
      150,
      TODAY,
    );
    expect(rows[0]).toMatchObject({ id: "cut", delta: -20, upcoming: true });
    expect(rows[1]).toMatchObject({ id: "up", delta: 10, upcoming: false });
  });
});

describe("buildRateHistory · boundaries", () => {
  it("treats a change effective today as applied, not upcoming", () => {
    const rows = buildRateHistory([change("now", TODAY, 160)], 150, TODAY);
    expect(rows[0]).toMatchObject({ id: "now", delta: 10, upcoming: false });
  });
});

describe("currentDailyRate", () => {
  const changes = [
    change("future", "2026-10-01", 200),
    change("past", "2026-06-01", 170),
  ];

  it("ignores the schema's 0 default for current_daily_rate", () => {
    expect(
      currentDailyRate(
        { daily_rate: 150, current_daily_rate: 0 },
        changes,
        TODAY,
      ),
    ).toBe(170);
  });

  it("counts a change effective today as in force", () => {
    expect(
      currentDailyRate({ daily_rate: 150 }, [change("now", TODAY, 175)], TODAY),
    ).toBe(175);
  });

  it("trusts the backend's current_daily_rate when present", () => {
    expect(
      currentDailyRate(
        { daily_rate: 150, current_daily_rate: 170 },
        changes,
        TODAY,
      ),
    ).toBe(170);
  });

  it("resolves the latest change effective today when the field is missing", () => {
    expect(currentDailyRate({ daily_rate: 150 }, changes, TODAY)).toBe(170);
  });

  it("falls back to the base rate when every change is in the future", () => {
    expect(currentDailyRate({ daily_rate: 150 }, [changes[0]], TODAY)).toBe(
      150,
    );
  });
});
