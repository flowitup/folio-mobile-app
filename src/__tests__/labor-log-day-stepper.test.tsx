import { fireEvent, screen } from "@testing-library/react-native";

import "@/i18n";
import { LogDaySheet } from "@/features/labor/labor-sheets";
import {
  WORKER_MINH,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";

/** P-11: the extra-hours stepper keeps "0 h" on one line and 44 pt buttons. */
it("keeps the extra hours on one line between 44 pt buttons", async () => {
  await renderWithProviders(
    <LogDaySheet
      date="2026-11-20"
      workers={[WORKER_MINH]}
      loggedWorkerIds={new Set()}
      lastDayEntries={[]}
      submitting={false}
      onSubmit={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByTestId(`log-tile-${WORKER_MINH.id}`));

  const value = screen.getByTestId(`log-supp-value-${WORKER_MINH.id}`);
  expect(value).toHaveTextContent("0 h");
  expect(value.props.numberOfLines).toBe(1);
  for (const id of ["minus", "plus"])
    expect(screen.getByTestId(`log-supp-${id}-${WORKER_MINH.id}`)).toHaveProp(
      "className",
      expect.stringContaining("h-11 w-11"),
    );

  await fireEvent.press(screen.getByTestId(`log-supp-plus-${WORKER_MINH.id}`));
  expect(
    screen.getByTestId(`log-supp-value-${WORKER_MINH.id}`),
  ).toHaveTextContent("1 h");
});
