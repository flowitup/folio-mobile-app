import { useState } from "react";
import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import "@/i18n";
import { Select } from "@/components/ui/select";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const OPTIONS = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
];

function ClearableHarness() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <Select
      testID="picker"
      clearable
      placeholder="No payment method"
      value={value}
      options={OPTIONS}
      onChange={setValue}
    />
  );
}

function PlainHarness() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <Select
      testID="picker"
      placeholder="Pick one"
      value={value}
      options={OPTIONS}
      onChange={setValue}
    />
  );
}

async function mount(element: React.ReactElement) {
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      {element}
    </SafeAreaProvider>,
  );
}

describe("clearable Select", () => {
  it("returns an optional field to its placeholder after a value was picked", async () => {
    await mount(<ClearableHarness />);

    await fireEvent.press(screen.getByTestId("picker"));
    await fireEvent.press(screen.getByTestId("picker-option-a"));
    expect(
      within(screen.getByTestId("picker")).getByText("Option A"),
    ).toBeTruthy();

    // Without this row the options can only ever set a value: every one of them writes a
    // non-null id, so an optional field stayed filled for the rest of the form's life.
    await fireEvent.press(screen.getByTestId("picker"));
    await fireEvent.press(screen.getByTestId("picker-option-none"));
    expect(
      within(screen.getByTestId("picker")).getByText("No payment method"),
    ).toBeTruthy();
  });

  it("offers no clear row on a field that must hold a value", async () => {
    await mount(<PlainHarness />);

    await fireEvent.press(screen.getByTestId("picker"));
    expect(screen.queryByTestId("picker-option-none")).toBeNull();
  });
});
