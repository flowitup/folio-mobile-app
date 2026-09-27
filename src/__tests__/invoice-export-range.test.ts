import { MAX_EXPORT_MONTHS, monthSpan } from "@/lib/labor/month-range";

/**
 * The export endpoint answers 422 for a backwards range and for anything longer than two
 * years. The sheet disables its button on exactly these two cases, which is this span.
 */
describe("monthSpan", () => {
  it("counts both ends of the range", () => {
    expect(monthSpan("2026-09", "2026-09")).toBe(1);
    expect(monthSpan("2026-01", "2026-12")).toBe(12);
    expect(monthSpan("2025-12", "2026-01")).toBe(2);
  });

  it("reads a backwards range as no range at all", () => {
    expect(monthSpan("2026-09", "2026-08")).toBeLessThan(1);
    expect(monthSpan("2026-01", "2025-12")).toBeLessThan(1);
  });

  it("puts the refusal boundary just past two years", () => {
    expect(monthSpan("2025-01", "2026-12")).toBe(MAX_EXPORT_MONTHS);
    expect(monthSpan("2025-01", "2027-01")).toBe(MAX_EXPORT_MONTHS + 1);
  });
});
