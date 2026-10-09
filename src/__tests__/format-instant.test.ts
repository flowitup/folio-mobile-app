import i18n from "../i18n";
import { formatInstant } from "../lib/format/date";

/**
 * Upload / creation timestamps show the device's calendar day, not the UTC day: the API sends
 * naive UTC for attachments, `+00:00` for documents and RFC-1123 for templates.
 */
describe("formatInstant", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("reads a naive API timestamp as UTC: an 18:04Z upload is 10 Oct in Vietnam", () => {
    expect(
      formatInstant("2026-10-09T18:04:43.480832", "Asia/Ho_Chi_Minh"),
    ).toBe("10 Oct 2026");
    expect(formatInstant("2026-10-09T18:04:43.480832", "UTC")).toBe(
      "9 Oct 2026",
    );
  });

  it("honours an explicit offset and the RFC-1123 form", () => {
    expect(formatInstant("2026-10-09T22:30:00+00:00", "Europe/Paris")).toBe(
      "10 Oct 2026",
    );
    expect(formatInstant("2026-10-10T01:00:00+02:00", "UTC")).toBe(
      "9 Oct 2026",
    );
    expect(
      formatInstant("Fri, 09 Oct 2026 18:04:43 GMT", "Asia/Ho_Chi_Minh"),
    ).toBe("10 Oct 2026");
  });

  it("keeps a bare date as a calendar day and ignores empty or broken input", () => {
    expect(formatInstant("2026-10-09", "Pacific/Honolulu")).toBe("9 Oct 2026");
    expect(formatInstant(null)).toBe("");
    expect(formatInstant("not a date")).toBe("");
  });
});
