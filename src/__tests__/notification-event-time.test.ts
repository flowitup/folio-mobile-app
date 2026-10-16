import { eventTime } from "@/lib/notifications/event-time";

/** Bell entries show the time today and yesterday, a short date before that. */
describe("eventTime", () => {
  const now = new Date(2026, 9, 15, 18, 30);
  const iso = (d: Date) => d.toISOString();

  it("gives the time for an entry from today", () => {
    expect(eventTime(iso(new Date(2026, 9, 15, 9, 5)), now)).toEqual({
      day: "today",
      time: "09:05",
    });
  });

  it("flags yesterday with its time", () => {
    expect(eventTime(iso(new Date(2026, 9, 14, 22, 40)), now)).toEqual({
      day: "yesterday",
      time: "22:40",
    });
  });

  it("gives a short date without the current year before that", () => {
    const older = eventTime(iso(new Date(2026, 9, 2, 8, 0)), now);
    expect(older.day).toBe("date");
    expect(older.day === "date" && older.date).not.toMatch(/2026/);
    const lastYear = eventTime(iso(new Date(2025, 9, 2, 8, 0)), now);
    expect(lastYear.day === "date" && lastYear.date).toMatch(/2025/);
  });

  it("reads naive UTC timestamps from the API", () => {
    const naive = new Date(Date.UTC(2026, 9, 15, 7, 0))
      .toISOString()
      .slice(0, 19);
    expect(eventTime(naive, now).day).toBe("today");
  });
});
