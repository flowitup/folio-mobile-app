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

function Harness() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <Select
      testID="picker"
      value={value}
      options={[
        { value: "a", label: "Option A" },
        { value: "b", label: "Option B" },
      ]}
      onChange={setValue}
    />
  );
}

// `jest.setup.ts` mocks `@gorhom/bottom-sheet` with `@gorhom/bottom-sheet/mock`, which renders
// a plain inline view instead of the real native stacked-sheet implementation. That means this
// suite cannot reproduce the actual gorhom bug it is named after — the one where a nested
// picker sheet registered *after* its parent was already presented corrupted the real push
// stack (present()/dismiss() got applied to the wrong sheet). Under the mock, present()/dismiss()
// are no-ops on plain state, so "reopen and pick again" always passes here regardless of mount
// order. The real guard against that regression is the structural mount test in each sheet's own
// suite (e.g. `company-member-grants-sheet.test.tsx`, `assign-member-sheet.test.tsx`) asserting
// the nested picker(s) render unconditionally, before their data query resolves.
describe("Select picker", () => {
  it("reopens and accepts a new selection after being closed once", async () => {
    await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <Harness />
      </SafeAreaProvider>,
    );

    // First open + pick. The mock always renders the picker's option list alongside the field,
    // so scope the assertion to the field itself to avoid matching the option row's own label.
    await fireEvent.press(screen.getByTestId("picker"));
    await fireEvent.press(screen.getByTestId("picker-option-a"));
    expect(
      within(screen.getByTestId("picker")).getByText("Option A"),
    ).toBeTruthy();

    // Reopen the same picker (present() called again on the same ref) and pick a different
    // option — this must not be a no-op or throw, matching the "Quyền tuỳ chỉnh" / company
    // picker's requirement that a picker sheet is always reopenable.
    await fireEvent.press(screen.getByTestId("picker"));
    await fireEvent.press(screen.getByTestId("picker-option-b"));
    expect(
      within(screen.getByTestId("picker")).getByText("Option B"),
    ).toBeTruthy();
  });
});
