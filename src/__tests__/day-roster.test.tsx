import { render, screen } from "@testing-library/react-native";

import "@/i18n";
import { DayRoster } from "@/features/labor/day-roster";
import type { RosterRow } from "@/features/labor/roster-api";

const ROWS: RosterRow[] = [
  {
    worker_id: "w1",
    name: "Jean Dupont",
    status: "present",
    hours: 8,
    day_type: "full",
  },
  {
    worker_id: "w2",
    name: "Pierre Martin",
    status: "pending",
    hours: 4,
    day_type: "half",
  },
];

describe("DayRoster", () => {
  it("shows loading, then empty state when there is no row", async () => {
    const { rerender } = await render(<DayRoster rows={undefined} loading />);
    expect(screen.getByTestId("roster-loading")).toBeTruthy();

    await rerender(<DayRoster rows={[]} loading={false} />);
    expect(screen.queryByTestId("roster-loading")).toBeNull();
  });

  it("renders name, presence and hours for a member, never a currency amount", async () => {
    await render(<DayRoster rows={ROWS} loading={false} />);
    expect(screen.getByText("Jean Dupont")).toBeTruthy();
    expect(screen.getByText("Pierre Martin")).toBeTruthy();
    // No `payByWorkerId` supplied (member without project:view_pay) — no pay node at all, and
    // no currency-looking text (€ / VNĐ) leaked through any other label.
    expect(screen.queryByTestId("roster-pay-w1")).toBeNull();
    expect(screen.queryByTestId("roster-pay-w2")).toBeNull();
    expect(screen.queryByText(/€|VNĐ/)).toBeNull();
  });

  it("shows pay only for the workers present in payByWorkerId (project:view_pay)", async () => {
    await render(
      <DayRoster rows={ROWS} loading={false} payByWorkerId={{ w1: 150000 }} />,
    );
    expect(screen.getByTestId("roster-pay-w1")).toBeTruthy();
    expect(screen.queryByTestId("roster-pay-w2")).toBeNull();
  });

  it("shows an inline error with retry (not the empty state) when the query fails", async () => {
    const onRetry = jest.fn();
    await render(
      <DayRoster rows={undefined} loading={false} error onRetry={onRetry} />,
    );
    expect(screen.getByTestId("error-state")).toBeTruthy();
    expect(screen.queryByTestId("empty-state")).toBeNull();
    expect(screen.queryByText("No one is scheduled today.")).toBeNull();
  });
});
