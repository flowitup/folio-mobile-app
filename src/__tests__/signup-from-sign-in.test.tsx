/**
 * D1: the sign-in screen sends a number with no account to sign-up with `?phone=`, so the field
 * is filled in. Sign-in and sign-up share the backend's per-number gap between two codes, so a
 * sign-up code asked right after a sign-in one is refused for a moment: that is a countdown,
 * not a failure.
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import i18n from "@/i18n";
import { AuthRequestError } from "@/lib/auth/auth-error-message";
import SignupScreen from "../../app/(auth)/signup";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const mockRequestSignupOtp = jest.fn();
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    requestSignupOtp: (...args: unknown[]) => mockRequestSignupOtp(...args),
    signUpWithOtp: jest.fn(),
  }),
}));

let mockParams: { phone?: string } = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

beforeEach(async () => {
  await i18n.changeLanguage("vi");
  mockParams = {};
  mockRequestSignupOtp.mockReset().mockResolvedValue(300);
});
afterEach(() => jest.useRealTimers());

async function renderScreen() {
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <SignupScreen />
    </SafeAreaProvider>,
  );
}

describe("sign-up opened from sign-in", () => {
  it("starts with the number from sign-in in the field", async () => {
    mockParams = { phone: "+33612345678" };
    await renderScreen();

    expect(screen.getByTestId("signup-phone")).toHaveDisplayValue(
      "6 12 34 56 78",
    );
    await fireEvent.press(screen.getByTestId("signup-send-code"));
    expect(mockRequestSignupOtp).toHaveBeenCalledWith("+33612345678");
  });

  it("ignores a phone parameter that is not a French number", async () => {
    mockParams = { phone: "hello" };
    await renderScreen();

    expect(screen.getByTestId("signup-phone")).toHaveDisplayValue("");
  });

  it("counts down the resend gap instead of reporting a failure", async () => {
    jest.useFakeTimers();
    mockRequestSignupOtp.mockRejectedValueOnce(
      new AuthRequestError(i18n.t("login.errors.throttled"), 429, {
        errorCode: "TooManyRequests",
        retryAfter: 40,
      }),
    );
    mockParams = { phone: "+33612345678" };
    await renderScreen();
    await fireEvent.press(screen.getByTestId("signup-send-code"));

    expect(await screen.findByTestId("signup-wait")).toHaveTextContent(
      i18n.t("signup.waitBeforeCode", { seconds: 40 }),
    );
    expect(screen.queryByTestId("signup-error")).toBeNull();
    expect(screen.getByTestId("signup-send-code")).toBeDisabled();

    await act(async () => {
      jest.advanceTimersByTime(41_000);
    });
    expect(screen.queryByTestId("signup-wait")).toBeNull();
    expect(screen.getByTestId("signup-send-code")).not.toBeDisabled();
    await fireEvent.press(screen.getByTestId("signup-send-code"));
    await waitFor(() => screen.getByTestId("signup-code"));
    expect(mockRequestSignupOtp).toHaveBeenCalledTimes(2);
  });

  it("still reports the hourly cap as an error", async () => {
    mockRequestSignupOtp.mockRejectedValueOnce(
      new AuthRequestError("too many codes", 429, {
        errorCode: "OtpHourlyLimit",
        retryAfter: 1800,
      }),
    );
    await renderScreen();
    await fireEvent.changeText(
      screen.getByTestId("signup-phone"),
      "06 12 34 56 78",
    );
    await fireEvent.press(screen.getByTestId("signup-send-code"));

    expect(await screen.findByTestId("signup-error")).toHaveTextContent(
      "too many codes",
    );
    expect(screen.queryByTestId("signup-wait")).toBeNull();
  });
});
