/**
 * The ink block keeps its DARK values in both palettes, so on those screens the clock
 * and battery sit on near-black whatever the theme says. `StatusBar style="auto"`
 * picks from the color scheme rather than from what is behind the bar, which put dark
 * glyphs on the dark block once the app defaulted to light — measured at 1.13:1
 * against the 4.5:1 WCAG AA floor.
 *
 * The first attempt rendered `<StatusBar style="light" />` inside the header. That
 * sets the bar on mount and never restores it, so leaving an ink screen for a paper
 * one left white glyphs on cream — 1.12:1 on the chat screen. Hence the focus
 * lifecycle: the screen owns the bar only while it is the focused screen.
 */

import { render } from "@testing-library/react-native";
import { Text } from "react-native";

import { useInkStatusBar } from "@/theme/use-ink-status-bar";

const mockSetStatusBarStyle = jest.fn();
let mockFocusCleanup: (() => void) | undefined;

jest.mock("expo-status-bar", () => ({
  setStatusBarStyle: (style: string) => mockSetStatusBarStyle(style),
}));

jest.mock("expo-router", () => ({
  // Runs the effect like a focused screen would, and keeps its cleanup so the
  // blur path can be exercised.
  useFocusEffect: (cb: () => undefined | (() => void)) => {
    mockFocusCleanup = cb() ?? undefined;
  },
}));

function Screen({ ink }: { ink: boolean }) {
  useInkStatusBar(ink);
  return <Text>screen</Text>;
}

describe("status bar over a fixed-darkness header", () => {
  beforeEach(() => {
    mockSetStatusBarStyle.mockClear();
    mockFocusCleanup = undefined;
  });

  it("asks for light glyphs while an ink screen is focused", async () => {
    await render(<Screen ink />);

    expect(mockSetStatusBarStyle).toHaveBeenCalledWith("light");
  });

  it("hands the bar back when the ink screen loses focus", async () => {
    await render(<Screen ink />);
    mockSetStatusBarStyle.mockClear();

    mockFocusCleanup?.();

    // Without this the next screen inherits white glyphs — on a paper header
    // that measured 1.12:1.
    expect(mockSetStatusBarStyle).toHaveBeenCalledWith("auto");
  });

  it("leaves the choice to the color scheme on a paper header", async () => {
    await render(<Screen ink={false} />);

    expect(mockSetStatusBarStyle).toHaveBeenCalledWith("auto");
    expect(mockSetStatusBarStyle).not.toHaveBeenCalledWith("light");
  });
});
