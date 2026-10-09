import { act, fireEvent, screen } from "@testing-library/react-native";
import { createRef } from "react";

import { WarehouseFormSheet } from "@/features/inventory/warehouse-form-sheet";
import {
  TaskFormSheet,
  type TaskFormSheetHandle,
} from "@/features/tasks/task-form-sheet";
import i18n, { DEFAULT_LOCALE } from "@/i18n";
import { TEXT_LIMITS } from "@/lib/format/text-limits";
import { renderWithProviders } from "./helpers/release-qa-fixtures";

/**
 * Over-long text reached the API and came back as a generic "invalid input" toast with the
 * sheet left open. The inputs now stop at the API's limits, and task labels (one comma
 * separated field) are checked before saving.
 */
beforeAll(async () => {
  await i18n.changeLanguage("en");
});
afterAll(async () => {
  await i18n.changeLanguage(DEFAULT_LOCALE);
});

async function renderTaskSheet(onSubmit: jest.Mock) {
  const ref = createRef<TaskFormSheetHandle>();
  await renderWithProviders(
    <TaskFormSheet
      ref={ref}
      submitting={false}
      assignees={[]}
      canDelete={false}
      onSubmit={onSubmit}
      onMove={jest.fn()}
      onDelete={jest.fn()}
      canMoveUp={() => false}
      canMoveDown={() => false}
    />,
  );
  await act(async () => ref.current?.open(null, "todo"));
}

describe("task form limits", () => {
  it("caps the title and description at the API limits", async () => {
    await renderTaskSheet(jest.fn());
    expect(screen.getByTestId("task-title").props.maxLength).toBe(255);
    expect(screen.getByTestId("task-description").props.maxLength).toBe(
      TEXT_LIMITS.task.description,
    );
  });

  it("refuses a label over 50 characters", async () => {
    const onSubmit = jest.fn();
    await renderTaskSheet(onSubmit);
    await fireEvent.changeText(screen.getByTestId("task-title"), "Pour slab");
    await fireEvent.changeText(
      screen.getByTestId("task-labels"),
      `ok, ${"x".repeat(51)}`,
    );
    await fireEvent.press(screen.getByTestId("task-submit"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText("Each label can have at most 50 characters."),
    ).toBeTruthy();
  });

  it("refuses more than 20 labels", async () => {
    const onSubmit = jest.fn();
    await renderTaskSheet(onSubmit);
    await fireEvent.changeText(screen.getByTestId("task-title"), "Pour slab");
    await fireEvent.changeText(
      screen.getByTestId("task-labels"),
      Array.from({ length: 21 }, (_, i) => `l${i}`).join(", "),
    );
    await fireEvent.press(screen.getByTestId("task-submit"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("A task can have at most 20 labels.")).toBeTruthy();
  });

  it("saves labels within the limits", async () => {
    const onSubmit = jest.fn();
    await renderTaskSheet(onSubmit);
    await fireEvent.changeText(screen.getByTestId("task-title"), "Pour slab");
    await fireEvent.changeText(
      screen.getByTestId("task-labels"),
      `ok, ${"x".repeat(50)}`,
    );
    await fireEvent.press(screen.getByTestId("task-submit"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ["ok", "x".repeat(50)] }),
      null,
    );
  });
});

describe("warehouse form limits", () => {
  it("caps the name and address at the API limits", async () => {
    await renderWithProviders(
      <WarehouseFormSheet
        ref={createRef()}
        submitting={false}
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.getByTestId("warehouse-name").props.maxLength).toBe(120);
    expect(screen.getByTestId("warehouse-address").props.maxLength).toBe(500);
  });
});
