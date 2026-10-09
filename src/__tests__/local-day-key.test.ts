import { localDayKey } from "../lib/format/date";

/**
 * Notes are grouped under the device's calendar day: a note written at 00:30 in Paris is
 * still the previous day in UTC and must not be filed under it. The expected keys are built
 * from the device's own calendar fields, so the test holds in any time zone.
 */
function deviceDay(utcMs: number): string {
  const d = new Date(utcMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("localDayKey", () => {
  it("keys an instant by the device's calendar day, not the UTC one", () => {
    expect(localDayKey("2026-10-09T22:30:00.123456+00:00")).toBe(
      deviceDay(Date.UTC(2026, 9, 9, 22, 30)),
    );
    expect(localDayKey("2026-10-10T01:00:00+02:00")).toBe(
      deviceDay(Date.UTC(2026, 9, 9, 23, 0)),
    );
  });

  it("reads a naive timestamp as UTC and accepts the RFC-1123 form", () => {
    const expected = deviceDay(Date.UTC(2026, 9, 9, 18, 4, 43));
    expect(localDayKey("2026-10-09T18:04:43.480832")).toBe(expected);
    expect(localDayKey("Fri, 09 Oct 2026 18:04:43 GMT")).toBe(expected);
  });

  it("falls back to the date prefix of an unparsable value", () => {
    expect(localDayKey("2026-10-09 garbage")).toBe("2026-10-09");
  });
});
