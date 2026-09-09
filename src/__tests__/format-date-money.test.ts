import i18n from "../i18n";
import {
  formatDate,
  parseIsoDate,
  shiftMonth,
  toIsoDate,
} from "../lib/format/date";
import { formatMoney, parseMoneyInput, splitMoney } from "../lib/format/money";

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

  it("parses comma and dot decimals", () => {
    expect(parseMoneyInput("1 234,50")).toBe(1234.5);
    expect(parseMoneyInput("76.9")).toBe(76.9);
    expect(parseMoneyInput("1.234,50")).toBe(1234.5);
    expect(parseMoneyInput("1,234.50")).toBe(1234.5);
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("x")).toBeNull();
  });
});

describe("parseIsoDate RFC-1123 fallback", () => {
  it("reads Flask's GMT date form as a calendar day", () => {
    const date = parseIsoDate("Thu, 03 Sep 2026 00:00:00 GMT");
    expect(date && toIsoDate(date)).toBe("2026-09-03");
    expect(parseIsoDate("not a date")).toBeNull();
  });
});
