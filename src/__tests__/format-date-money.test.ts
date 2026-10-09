import i18n from "../i18n";
import {
  formatDate,
  parisDayKey,
  parseIsoDate,
  shiftMonth,
  toIsoDate,
} from "../lib/format/date";
import {
  formatAmountInput,
  formatMoney,
  formatNumber,
  formatUnitPrice,
  parseCentsInput,
  parseMoneyInput,
  splitMoney,
} from "../lib/format/money";

describe("date helpers", () => {
  it("round-trips ISO dates through local calendar fields", () => {
    const date = parseIsoDate("2026-09-03");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(8);
    expect(toIsoDate(date!)).toBe("2026-09-03");
  });

  it("shifts months across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("files a timestamp under its Paris day, as the web photo gallery does", () => {
    // 22:30 UTC is 00:30 the next day in Paris (summer and winter time).
    expect(parisDayKey("2026-10-01T22:30:00+00:00")).toBe("2026-10-02");
    expect(parisDayKey("2026-12-31T23:30:00Z")).toBe("2027-01-01");
    expect(parisDayKey("2026-10-01T21:30:00+00:00")).toBe("2026-10-01");
    expect(parisDayKey("2026-01-15T22:30:00Z")).toBe("2026-01-15");
    expect(parisDayKey("not a date")).toBe("not a date");
    // Python isoformat with microseconds, and a naive timestamp read as UTC
    expect(parisDayKey("2026-10-09T22:37:13.433392+00:00")).toBe("2026-10-10");
    expect(parisDayKey("2026-10-09T22:37:13")).toBe("2026-10-10");
  });

  it("formats in the active locale", async () => {
    await i18n.changeLanguage("fr");
    expect(formatDate("2026-09-03")).toMatch(/sept/);
    await i18n.changeLanguage("en");
    expect(formatDate("2026-09-03")).toMatch(/Sep/);
  });
});

describe("money helpers", () => {
  it("formats euros per locale and ignores empty input", () => {
    expect(formatMoney(null)).toBe("");
    expect(formatMoney("abc")).toBe("");
    expect(formatMoney(1234.5).replace(/ /g, " ")).toContain("1,234.50");
  });

  it("splits the integer part from decimals and currency for headline figures", async () => {
    await i18n.changeLanguage("vi");
    const vi = splitMoney(97640);
    expect(vi.main.replace(/\u00a0/g, " ")).toBe("97.640");
    expect(vi.rest.replace(/\u00a0/g, " ")).toBe(",00 €");
    await i18n.changeLanguage("en");
    const en = splitMoney(1234.5);
    expect(en.main).toBe("€1,234");
    expect(en.rest).toBe(".50");
    expect(splitMoney(-2.5)).toEqual({ main: "-€2", rest: ".50" });
    expect(splitMoney(0.999)).toEqual({ main: "€1", rest: ".00" });
    expect(splitMoney(null)).toEqual({ main: "", rest: "" });
  });

  it("formats quantities and rates with the locale's decimal mark", async () => {
    await i18n.changeLanguage("fr");
    expect(formatNumber(1.5)).toBe("1,5");
    expect(formatNumber("5.5")).toBe("5,5");
    expect(formatNumber(10)).toBe("10");
    await i18n.changeLanguage("vi");
    expect(formatNumber(0.25)).toBe("0,25");
    await i18n.changeLanguage("en");
    expect(formatNumber(1.5)).toBe("1.5");
    expect(formatNumber(null)).toBe("");
    expect(formatNumber("x")).toBe("");
  });

  it("pre-fills amount fields in cents with the locale's decimal mark", async () => {
    // 149.99 - 100.33 is 49.66000000000001 in floating point.
    await i18n.changeLanguage("fr");
    expect(formatAmountInput(149.99 - 100.33)).toBe("49,66");
    expect(formatAmountInput(1234.5)).toBe("1234,5");
    expect(formatAmountInput(50)).toBe("50");
    expect(formatAmountInput(1.005)).toBe("1,01");
    await i18n.changeLanguage("vi");
    expect(formatAmountInput(0.1 + 0.2)).toBe("0,3");
    await i18n.changeLanguage("en");
    expect(formatAmountInput(149.99 - 100.33)).toBe("49.66");
    expect(formatAmountInput(12345.678)).toBe("12345.68");
    expect(parseMoneyInput(formatAmountInput(149.99 - 100.33))).toBe(49.66);
    expect(formatAmountInput(Number.NaN)).toBe("");
  });

  it("parses comma and dot decimals", () => {
    expect(parseMoneyInput("1 234,50")).toBe(1234.5);
    expect(parseMoneyInput("76.9")).toBe(76.9);
    expect(parseMoneyInput("1.234,50")).toBe(1234.5);
    expect(parseMoneyInput("1,234.50")).toBe(1234.5);
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("x")).toBeNull();
  });

  it("keeps a unit price's own decimals, at least two", async () => {
    await i18n.changeLanguage("fr");
    const fr = (n: number) =>
      formatUnitPrice(n).replace(/[\u202f\u00a0]/g, " ");
    expect(fr(15.015)).toBe("15,015 €");
    expect(fr(1234.565)).toBe("1 234,565 €");
    expect(fr(200)).toBe("200,00 €");
    expect(fr(0.1 + 0.2)).toBe("0,30 €");
    expect(formatUnitPrice(null)).toBe("");
    await i18n.changeLanguage("en");
  });

  it("rounds typed amounts to the cent", () => {
    expect(parseCentsInput("0,004")).toBe(0);
    expect(parseCentsInput("0,005")).toBe(0.01);
    expect(parseCentsInput("150,129")).toBe(150.13);
    expect(parseCentsInput("x")).toBeNull();
  });
});

describe("parseIsoDate RFC-1123 fallback", () => {
  it("reads Flask's GMT date form as a calendar day", () => {
    const date = parseIsoDate("Thu, 03 Sep 2026 00:00:00 GMT");
    expect(date && toIsoDate(date)).toBe("2026-09-03");
    expect(parseIsoDate("not a date")).toBeNull();
  });
});
