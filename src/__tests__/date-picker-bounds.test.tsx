import { fireEvent, render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";

import { DatePicker } from "@/components/ui/date-picker";
import { MAX_BUSINESS_DATE, MIN_BUSINESS_DATE } from "@/lib/format/date-bounds";

/**
 * The expense date picker stops at the years the API accepts (2000-2100): a date the
 * spinner could still reach, like 1900 or 9999, was refused by the API with a 400.
 */
const mockPickerProps: Record<string, unknown>[] = [];
jest.mock(
  "@react-native-community/datetimepicker",
  () =>
    function DateTimePicker(props: Record<string, unknown>) {
      mockPickerProps.push(props);
      return null;
    },
);

beforeEach(() => {
  mockPickerProps.length = 0;
});

describe("DatePicker bounds", () => {
  it("passes the ISO bounds to the native picker as local dates", async () => {
    expect(Platform.OS).toBe("ios");
    await render(
      <DatePicker
        testID="day"
        value="2026-10-09"
        onChange={jest.fn()}
        minimumDate={MIN_BUSINESS_DATE}
        maximumDate={MAX_BUSINESS_DATE}
      />,
    );
    await fireEvent.press(screen.getByTestId("day"));

    const props = mockPickerProps[mockPickerProps.length - 1];
    expect(props.minimumDate).toEqual(new Date(2000, 0, 1));
    expect(props.maximumDate).toEqual(new Date(2100, 11, 31));
  });

  it("leaves the picker unbounded when no bounds are given", async () => {
    await render(<DatePicker testID="day" value={null} onChange={jest.fn()} />);
    await fireEvent.press(screen.getByTestId("day"));

    const props = mockPickerProps[mockPickerProps.length - 1];
    expect(props).toBeDefined();
    expect(props.minimumDate).toBeUndefined();
    expect(props.maximumDate).toBeUndefined();
  });
});
