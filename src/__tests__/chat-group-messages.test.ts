import {
  dayDividerLabel,
  groupMessagesByDay,
  showsSender,
  timeOf,
} from "@/lib/chat/group-messages-by-day";

const message = (iso: string, sender: string, mine = false) => ({
  created_at: iso,
  sender_id: sender,
  mine,
});

describe("groupMessagesByDay", () => {
  it("splits consecutive messages into day groups", () => {
    const groups = groupMessagesByDay([
      message("2026-09-03T07:30:00+00:00", "a"),
      message("2026-09-03T09:00:00+00:00", "b"),
      message("2026-09-04T08:10:00+00:00", "a"),
    ]);
    expect(groups.map((g) => [g.dayKey, g.messages.length])).toEqual([
      ["2026-09-03", 2],
      ["2026-09-04", 1],
    ]);
  });

  it("labels today, yesterday and older days", () => {
    const today = new Date(2026, 8, 4);
    expect(dayDividerLabel("2026-09-04", today)).toEqual({ token: "today" });
    expect(dayDividerLabel("2026-09-03", today)).toEqual({
      token: "yesterday",
    });
    expect(dayDividerLabel("2026-08-22", today)).toEqual({ date: "22/08" });
  });

  it("shows the sender header only on the first message of a run, never on mine", () => {
    const list = [
      message("2026-09-04T08:00:00Z", "a"),
      message("2026-09-04T08:01:00Z", "a"),
      message("2026-09-04T08:02:00Z", "me", true),
      message("2026-09-04T08:03:00Z", "a"),
    ];
    expect(list.map((_, i) => showsSender(list, i))).toEqual([
      true,
      false,
      false,
      true,
    ]);
  });

  it("formats local HH:mm", () => {
    const local = new Date(2026, 8, 4, 7, 5);
    expect(timeOf(local.toISOString())).toBe("07:05");
  });
});
