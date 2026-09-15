/**
 * The point of the setting is that the app can disagree with the phone, so what is
 * asserted here is the override reaching NativeWind — the single source of truth for
 * both the `prefers-color-scheme` block in global.css (every className) and
 * `useTokens()` (the JS colors). If only one of those moved, the app would render
 * half-light, half-dark.
 */

import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { colorScheme } from "nativewind";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import AppearanceScreen from "@/../app/(app)/(tabs)/settings/appearance";
import i18n from "@/i18n";
import {
  ThemePreferenceProvider,
  useThemePreference,
} from "@/theme/theme-preference";

jest.mock("nativewind", () => ({
  ...jest.requireActual("nativewind"),
  colorScheme: { set: jest.fn(), get: jest.fn(() => "light") },
  useColorScheme: () => ({ colorScheme: "light" }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const setColorScheme = colorScheme.set as jest.Mock;
const getItem = SecureStore.getItemAsync as jest.Mock;
const setItem = SecureStore.setItemAsync as jest.Mock;

async function renderScreen() {
  await i18n.changeLanguage("fr");
  // RNTL 14 resolves `render` asynchronously here.
  return await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <ThemePreferenceProvider>
        <AppearanceScreen />
      </ThemePreferenceProvider>
    </SafeAreaProvider>,
  );
}

describe("Settings → Appearance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getItem.mockResolvedValue(null);
  });

  it("offers device, light and dark", async () => {
    await renderScreen();

    expect(screen.getByTestId("appearance-system")).toBeTruthy();
    expect(screen.getByTestId("appearance-light")).toBeTruthy();
    expect(screen.getByTestId("appearance-dark")).toBeTruthy();
  });

  it("defaults to following the device", async () => {
    await renderScreen();

    expect(
      screen.getByTestId("appearance-system").props.accessibilityState,
    ).toEqual(expect.objectContaining({ selected: true }));
  });

  it("pushes the choice into NativeWind so classNames and JS colors move together", async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId("appearance-dark"));

    expect(setColorScheme).toHaveBeenCalledWith("dark");
  });

  it("remembers the choice for the next launch", async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId("appearance-dark"));

    await waitFor(() =>
      expect(setItem).toHaveBeenCalledWith("theme_preference", "dark"),
    );
  });

  it("restores a stored choice on launch", async () => {
    getItem.mockResolvedValue("dark");

    await renderScreen();

    await waitFor(() => expect(setColorScheme).toHaveBeenCalledWith("dark"));
    await waitFor(() =>
      expect(
        screen.getByTestId("appearance-dark").props.accessibilityState,
      ).toEqual(expect.objectContaining({ selected: true })),
    );
  });

  it("ignores a corrupted stored value rather than crashing", async () => {
    getItem.mockResolvedValue("chartreuse");

    await renderScreen();

    expect(setColorScheme).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("appearance-system").props.accessibilityState,
    ).toEqual(expect.objectContaining({ selected: true }));
  });

  it("survives storage being unavailable", async () => {
    getItem.mockRejectedValue(new Error("keychain locked"));

    await renderScreen();

    expect(screen.getByTestId("appearance-system")).toBeTruthy();
  });
});

describe("useThemePreference", () => {
  it("refuses to be used outside the provider", async () => {
    function Orphan() {
      useThemePreference();
      return <Text>never</Text>;
    }
    const spy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    let caught: unknown;
    try {
      await render(<Orphan />);
    } catch (error) {
      caught = error;
    }

    expect((caught as Error | undefined)?.message).toMatch(
      /ThemePreferenceProvider/,
    );
    spy.mockRestore();
  });
});
