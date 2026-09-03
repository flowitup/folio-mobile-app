import { fireEvent, render, screen } from "@testing-library/react-native";

import { Button } from "../components/ui/button";
import { ConfirmDialog } from "../components/ui/confirm-dialog";

describe("Button", () => {
  it("fires onPress and blocks presses while loading", async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} testID="btn" />);
    await fireEvent.press(screen.getByTestId("btn"));
    expect(onPress).toHaveBeenCalledTimes(1);

    await screen.rerender(
      <Button label="Save" onPress={onPress} testID="btn" loading />,
    );
    await fireEvent.press(screen.getByTestId("btn"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Save")).toBeNull();
  });
});

describe("ConfirmDialog", () => {
  it("routes confirm and cancel taps", async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await render(
      <ConfirmDialog
        visible
        title="Delete project?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    await fireEvent.press(screen.getByTestId("confirm-ok"));
    await fireEvent.press(screen.getByTestId("confirm-cancel"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
