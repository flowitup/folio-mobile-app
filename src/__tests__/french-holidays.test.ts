import {
  frenchHolidayKeyForIso,
  getFrenchHolidayKey,
} from "@/lib/labor/french-holidays";

describe("french holidays", () => {
  it("marks the fixed-date holidays", () => {
    expect(frenchHolidayKeyForIso("2026-01-01")).toBe("newYear");
    expect(frenchHolidayKeyForIso("2026-05-01")).toBe("labourDay");
    expect(frenchHolidayKeyForIso("2026-05-08")).toBe("victory1945");
    expect(frenchHolidayKeyForIso("2026-07-14")).toBe("bastilleDay");
    expect(frenchHolidayKeyForIso("2026-08-15")).toBe("assumption");
    expect(frenchHolidayKeyForIso("2026-11-01")).toBe("allSaints");
    expect(frenchHolidayKeyForIso("2026-11-11")).toBe("armistice1918");
    expect(frenchHolidayKeyForIso("2026-12-25")).toBe("christmas");
  });

  it("derives the movable feasts from Easter (2026: Easter Sunday = April 5)", () => {
    expect(frenchHolidayKeyForIso("2026-04-06")).toBe("easterMonday");
    expect(frenchHolidayKeyForIso("2026-05-14")).toBe("ascension");
    expect(frenchHolidayKeyForIso("2026-05-25")).toBe("pentecostMonday");
  });

  it("handles another year (2025: Easter Sunday = April 20)", () => {
    expect(frenchHolidayKeyForIso("2025-04-21")).toBe("easterMonday");
    expect(frenchHolidayKeyForIso("2025-05-29")).toBe("ascension");
    expect(frenchHolidayKeyForIso("2025-06-09")).toBe("pentecostMonday");
  });

  it("returns null for ordinary days and garbage", () => {
    expect(frenchHolidayKeyForIso("2026-09-07")).toBeNull();
    expect(frenchHolidayKeyForIso("nope")).toBeNull();
    expect(getFrenchHolidayKey(new Date(2026, 6, 14))).toBe("bastilleDay");
    expect(getFrenchHolidayKey(new Date(2026, 6, 15))).toBeNull();
  });
});
