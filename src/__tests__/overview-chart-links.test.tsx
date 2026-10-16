import { fireEvent, render, screen } from "@testing-library/react-native";

import i18n from "@/i18n";
import {
  AgendaCard,
  MonthSpendCard,
  TypeTrendsCard,
  compactAmount,
} from "@/features/dashboard/overview-cards";
import type { TypeMonthlyBucket } from "@/lib/dashboard/overview-metrics";

/**
 * The overview charts drill down (owner-dataviz-03, Mac (c)): a month bar opens that type's
 * month, a type opens its type, ticks are month names, each bar shows its value.
 */
const KEYS = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];

function buckets(): TypeMonthlyBucket[] {
  return (["labor", "materials_services", "others"] as const).map((type) => ({
    type,
    monthly: KEYS.map((key, i) => ({
      key,
      total: type === "labor" ? (i + 1) * 400 : 0,
      count: type === "labor" ? 1 : 0,
      credited: 0,
      creditCount: 0,
    })),
    total: type === "labor" ? 8400 : 0,
    count: type === "labor" ? 6 : 0,
    deltaPct: type === "labor" ? 20 : null,
  })) as TypeMonthlyBucket[];
}

describe("overview chart links", () => {
  beforeEach(() => i18n.changeLanguage("fr"));
  afterAll(() => i18n.changeLanguage("en"));

  it("opens the type's expenses of the tapped month, and names the months", async () => {
    const open = jest.fn();
    await render(<TypeTrendsCard buckets={buckets()} onOpenExpenses={open} />);
    await fireEvent.press(
      screen.getByTestId("overview-trend-bar-labor-2026-09"),
    );
    expect(open).toHaveBeenLastCalledWith({ type: "labor", month: "2026-09" });
    await fireEvent.press(screen.getByTestId("overview-trend-type-labor"));
    expect(open).toHaveBeenLastCalledWith({ type: "labor" });
    expect(
      screen.getByTestId("overview-trend-tick-labor-2026-05"),
    ).toHaveTextContent("mai");
    expect(
      screen.getByTestId("overview-trend-value-labor-2026-10"),
    ).toHaveTextContent(/2,4\s?k/);
  });

  it("uses compact T<n> ticks in Vietnamese", async () => {
    await i18n.changeLanguage("vi");
    await render(
      <TypeTrendsCard buckets={buckets()} onOpenExpenses={jest.fn()} />,
    );
    expect(
      screen.getByTestId("overview-trend-tick-labor-2026-09"),
    ).toHaveTextContent("T9");
  });

  it("opens the current month, and a type of it, from the month card", async () => {
    const open = jest.fn();
    await render(
      <MonthSpendCard
        buckets={buckets()}
        currentMonthKey="2026-10"
        totalCurrent={2400}
        totalDeltaPct={20}
        onOpenExpenses={open}
      />,
    );
    await fireEvent.press(screen.getByTestId("overview-type-open-labor"));
    expect(open).toHaveBeenLastCalledWith({ month: "2026-10", type: "labor" });
    await fireEvent.press(screen.getByTestId("overview-spend-by-type"));
    expect(open).toHaveBeenLastCalledWith({ month: "2026-10" });
  });

  it("opens a task from its agenda row", async () => {
    const openTask = jest.fn();
    await render(
      <AgendaCard
        groups={
          [
            {
              key: "overdue",
              tasks: [
                {
                  id: "t1",
                  title: "Poser le carrelage",
                  due_date: "2026-10-01",
                },
              ],
            },
          ] as never
        }
        onOpenPlanning={jest.fn()}
        onOpenTask={openTask}
      />,
    );
    await fireEvent.press(screen.getByTestId("overview-agenda-task-t1"));
    expect(openTask).toHaveBeenCalledWith("t1");
  });

  it("writes bar values in a few characters", async () => {
    expect(compactAmount(850)).toBe("850");
    expect(compactAmount(1200)).toMatch(/^1,2\s?k$/);
    expect(compactAmount(15000)).toMatch(/^15\s?k$/);
  });
});
