import { Keyboard, Platform, Text } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import "@/i18n";
import { Sheet } from "@/components/ui/sheet";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

type Listener = (event: { endCoordinates: { height: number } }) => void;

/** Mounts a sheet on `os` and hands back a way to play keyboard events at it. */
async function mountSheetOn(os: "android" | "ios") {
  const listeners = new Map<string, Listener[]>();
  jest.spyOn(Keyboard, "addListener").mockImplementation(((
    event: string,
    listener: Listener,
  ) => {
    listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    return { remove: jest.fn() };
  }) as never);
  jest.replaceProperty(Platform, "OS", os);

  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <Sheet title="Form">
        <Text>body</Text>
      </Sheet>
    </SafeAreaProvider>,
  );

  return async (event: string, height = 0) =>
    await act(async () => {
      for (const listener of listeners.get(event) ?? [])
        listener({ endCoordinates: { height } });
    });
}

function paddingBottom(): number {
  const style = screen.getByTestId("sheet-scroll").props.contentContainerStyle;
  const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
  return flat.paddingBottom;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Sheet and the keyboard", () => {
  it("lets a tap reach a button instead of spending it on dismissing the keyboard", async () => {
    await mountSheetOn("android");

    // Every other scroller in the app sets this; the shared Sheet was the one that did
    // not, so its submit buttons needed two presses whenever a field was focused.
    expect(
      screen.getByTestId("sheet-scroll").props.keyboardShouldPersistTaps,
    ).toBe("handled");
  });

  it("leaves room for the keyboard on Android, where the window does not resize", async () => {
    const keyboard = await mountSheetOn("android");
    const resting = paddingBottom();

    await keyboard("keyboardDidShow", 320);
    expect(paddingBottom()).toBe(resting + 320);

    await keyboard("keyboardDidHide");
    expect(paddingBottom()).toBe(resting);
  });

  it("leaves iOS alone, where gorhom lifts the sheet itself", async () => {
    const keyboard = await mountSheetOn("ios");
    const resting = paddingBottom();

    await keyboard("keyboardDidShow", 320);
    expect(paddingBottom()).toBe(resting);
  });
});
