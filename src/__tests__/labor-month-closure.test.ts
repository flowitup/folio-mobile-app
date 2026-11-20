import { formatInstantDateTime } from "@/lib/format/date";
import i18n, { DEFAULT_LOCALE } from "@/i18n";
import {
  closeChecklist,
  closedMonthsFor,
  closureFor,
  monthKeyOf,
} from "@/lib/labor/month-closure";

/** "Chốt tháng" (QĐ-10): which closed months a write touches, and the close checklist. */

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

const CLOSED = [{ month: "2026-10" }, { month: "2026-09" }];

describe("monthKeyOf", () => {
  it("reads the month of a day or a month", () => {
    expect(monthKeyOf("2026-10-15")).toBe("2026-10");
    expect(monthKeyOf("2026-10")).toBe("2026-10");
    expect(monthKeyOf("")).toBeNull();
    expect(monthKeyOf(null)).toBeNull();
    expect(monthKeyOf("next week")).toBeNull();
  });
});

describe("closedMonthsFor", () => {
  it("lists the closed months a write touches, once each, sorted", () => {
    expect(
      closedMonthsFor(CLOSED, ["2026-10-15", "2026-09-02", "2026-10-31"]),
    ).toEqual(["2026-09", "2026-10"]);
  });

  it("is empty for days in open months or no day at all", () => {
    expect(closedMonthsFor(CLOSED, ["2026-11-03", null, undefined])).toEqual(
      [],
    );
    expect(closedMonthsFor([], ["2026-10-15"])).toEqual([]);
  });
});

describe("closureFor", () => {
  it("finds the closure of a month", () => {
    expect(closureFor(CLOSED, "2026-09")).toEqual({ month: "2026-09" });
    expect(closureFor(CLOSED, "2026-11")).toBeUndefined();
    expect(closureFor(undefined, "2026-11")).toBeUndefined();
  });
});

describe("closeChecklist", () => {
  const payments = {
    months: [
      { year: 2026, month: 10, unassigned_count: 2, workers: [] },
      // Another month's unassigned payments are not this month's business.
      { year: 2026, month: 9, unassigned_count: 5, workers: [] },
      // No month at all: they settle nobody, whatever the month.
      {
        year: null,
        month: null,
        unassigned_count: 1,
        workers: [{ invoice_count: 3 }],
      },
    ],
  };

  it("counts pending days of the month, loose payments and what is owed", () => {
    const result = closeChecklist({
      month: "2026-10",
      entries: [
        { date: "2026-10-01", status: "pending" },
        { date: "2026-10-02", status: "validated" },
        { date: "2026-10-03", status: "pending" },
        { date: "2026-11-01", status: "pending" },
      ],
      payments,
      owed: 450,
    });
    expect(result).toEqual({
      pendingDays: 2,
      unsettledPayments: 6,
      owed: 450,
      loose: true,
    });
  });

  it("is all clear when nothing is loose", () => {
    expect(
      closeChecklist({
        month: "2026-10",
        entries: [{ date: "2026-10-02", status: "validated" }],
        payments: { months: [] },
        owed: -20,
      }),
    ).toEqual({ pendingDays: 0, unsettledPayments: 0, owed: 0, loose: false });
  });
});

describe("formatInstantDateTime", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });
  afterAll(async () => {
    await i18n.changeLanguage(DEFAULT_LOCALE);
  });

  it("shows day and time in the given time zone, naive timestamps read as UTC", () => {
    const text = formatInstantDateTime("2026-11-20T14:15:00", "Europe/Paris");
    expect(text).toContain("20 Nov 2026");
    expect(text).toContain("15:15");
  });

  it("keeps a bare day a day, and falls back on nothing", () => {
    expect(formatInstantDateTime("2026-11-20")).not.toContain(":");
    expect(formatInstantDateTime(null)).toBe("");
  });
});
