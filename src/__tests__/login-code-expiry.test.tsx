/**
 * The code step counts the texted code's lifetime down and says when it has expired. It used to
 * keep "Expires in 5 minutes" on screen forever, so a user typed a dead code and only learned
 * from the refusal (which also spent one of the backend's five attempts). The web flow already
 * switches to "Code expired — ask for a new one"; sign-in and the phone change now do too.
 */

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import { ChangePhoneForm } from "@/components/account/change-phone-form";
import i18n from "@/i18n";
import LoginScreen from "../../app/(auth)/index";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

jest.mock("@/auth/auth-config", () => ({
  ...jest.requireActual("@/auth/auth-config"),
  useAuthConfig: () => ({ data: { session: "expiring", signup: false } }),
}));

const mockRequestOtp = jest.fn();
const mockSignInWithOtp = jest.fn();
const mockRequestPhoneChangeCode = jest.fn();
const mockConfirmPhoneChange = jest.fn();
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    user: { id: "u1", phone: "+33611111111", permissions: [], companies: [] },
    requestOtp: (...args: unknown[]) => mockRequestOtp(...args),
    signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
    requestPhoneChangeCode: (...args: unknown[]) =>
      mockRequestPhoneChangeCode(...args),
    confirmPhoneChange: (...args: unknown[]) => mockConfirmPhoneChange(...args),
    signIn: jest.fn(),
  }),
}));

jest.mock("@/components/ui/toast", () => ({ showToast: jest.fn() }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

/**
 * Runs the fake clock forward one minute at a time and lets React flush after each step, as a
 * real device would between two timer wake-ups (each wake-up schedules the next one).
 */
async function elapseMinutes(minutes: number) {
  for (let step = 0; step < minutes; step += 1)
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
}

beforeEach(async () => {
  jest.useFakeTimers();
  await i18n.changeLanguage("en");
  mockRequestOtp.mockReset().mockResolvedValue(300);
  mockSignInWithOtp.mockReset().mockResolvedValue(undefined);
  mockRequestPhoneChangeCode.mockReset().mockResolvedValue(300);
  mockConfirmPhoneChange.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("sign-in code step — expiry", () => {
  async function sendCode() {
    await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <LoginScreen />
      </SafeAreaProvider>,
    );
    await fireEvent.changeText(screen.getByTestId("login-phone"), "0612345678");
    await fireEvent.press(screen.getByTestId("login-send-code"));
  }

  it("counts the minutes down, then says the code expired and stops submitting it", async () => {
    await sendCode();
    expect(screen.getByTestId("login-code-expiry")).toHaveTextContent(
      "Expires in 5 minutes",
    );

    await elapseMinutes(1);
    expect(screen.getByTestId("login-code-expiry")).toHaveTextContent(
      "Expires in 4 minutes",
    );

    await elapseMinutes(3);
    expect(screen.getByTestId("login-code-expiry")).toHaveTextContent(
      "Expires in 1 minute",
    );

    await elapseMinutes(1);
    expect(screen.getByTestId("login-code-expiry")).toHaveTextContent(
      "Code expired — ask for a new one",
    );

    // A dead code would only be refused and spend an attempt: nothing goes out.
    await fireEvent.changeText(screen.getByTestId("login-code-0"), "482917");
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
    expect(screen.getByTestId("login-verify")).toBeDisabled();

    // A new code restarts the clock.
    await fireEvent.press(screen.getByTestId("login-resend"));
    expect(mockRequestOtp).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("login-code-expiry")).toHaveTextContent(
      "Expires in 5 minutes",
    );
  });

  it("still explains the expiry when an earlier refusal is on screen", async () => {
    mockSignInWithOtp.mockRejectedValue(new Error("Wrong code"));
    await sendCode();
    await fireEvent.changeText(screen.getByTestId("login-code-0"), "482917");
    expect(screen.getByTestId("login-error")).toBeTruthy();
    expect(screen.queryByTestId("login-code-expiry")).toBeNull();

    await elapseMinutes(5);
    expect(screen.getByTestId("login-code-expiry")).toHaveTextContent(
      "Code expired — ask for a new one",
    );
    await fireEvent.changeText(screen.getByTestId("login-code-0"), "123456");
    expect(mockSignInWithOtp).toHaveBeenCalledTimes(1);
  });
});

describe("phone change code step — expiry", () => {
  it("says the code expired and stops confirming it", async () => {
    await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <ChangePhoneForm onDone={jest.fn()} />
      </SafeAreaProvider>,
    );
    await fireEvent.changeText(
      screen.getByTestId("change-phone-input"),
      "0622222222",
    );
    await fireEvent.press(screen.getByTestId("change-phone-send"));
    expect(screen.getByTestId("change-phone-code-expiry")).toHaveTextContent(
      "Expires in 5 minutes",
    );

    await elapseMinutes(5);
    expect(screen.getByTestId("change-phone-code-expiry")).toHaveTextContent(
      "Code expired — ask for a new one",
    );
    await fireEvent.changeText(
      screen.getByTestId("change-phone-code-0"),
      "482917",
    );
    expect(mockConfirmPhoneChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("change-phone-confirm")).toBeDisabled();
  });
});
