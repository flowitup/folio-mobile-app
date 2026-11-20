/**
 * P-04: a company adds someone by phone, but that creates no account — so every code the
 * sign-in screen asks for that number is refused, and the person used to stay stuck there.
 * A refused code now points to sign-up with the number already typed (D1), and a code asked for
 * a moment before the app was closed reopens the code step instead of "sign-in failed" (D3).
 */

import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import i18n from "@/i18n";
import { AuthRequestError } from "@/lib/auth/auth-error-message";
import LoginScreen from "../../app/(auth)/index";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let mockSignup = true;
jest.mock("@/auth/auth-config", () => ({
  useAuthConfig: () => ({ data: { session: "expiring", signup: mockSignup } }),
}));

const mockRequestOtp = jest.fn();
const mockSignInWithOtp = jest.fn();
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    requestOtp: (...args: unknown[]) => mockRequestOtp(...args),
    signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
  }),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const t = (key: string, values?: Record<string, unknown>) =>
  i18n.t(key, values) as string;

async function renderLogin() {
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <LoginScreen />
    </SafeAreaProvider>,
  );
}

async function sendCodeFor(phone: string) {
  await fireEvent.changeText(screen.getByTestId("login-phone"), phone);
  await fireEvent.press(screen.getByTestId("login-send-code"));
}

beforeEach(async () => {
  await i18n.changeLanguage("vi");
  mockSignup = true;
  mockPush.mockReset();
  mockRequestOtp.mockReset().mockResolvedValue(300);
  mockSignInWithOtp
    .mockReset()
    .mockRejectedValue(
      new AuthRequestError(t("login.errors.invalidCode"), 401),
    );
});

describe("a refused code points first-time users to sign-up (D1)", () => {
  it("offers to create an account with the number just typed", async () => {
    await renderLogin();
    await sendCodeFor("06 12 34 56 78");
    expect(screen.queryByTestId("login-first-time")).toBeNull();

    await fireEvent.changeText(screen.getByTestId("login-code-0"), "111111");

    expect(await screen.findByTestId("login-first-time")).toHaveTextContent(
      t("login.firstTime.body"),
      { exact: false },
    );
    await fireEvent.press(screen.getByTestId("login-first-time-signup"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/signup",
      params: { phone: "+33612345678" },
    });
  });

  it("says nothing about sign-up when the backend has it switched off", async () => {
    mockSignup = false;
    await renderLogin();
    await sendCodeFor("06 12 34 56 78");
    await fireEvent.changeText(screen.getByTestId("login-code-0"), "111111");

    await screen.findByTestId("login-error");
    expect(screen.queryByTestId("login-first-time")).toBeNull();
    expect(screen.getByTestId("login-code-help")).toHaveTextContent(
      t("login.codeHelp"),
    );
  });

  it("opens the help under the code with the way to sign up", async () => {
    await renderLogin();
    await sendCodeFor("06 12 34 56 78");

    expect(screen.getByTestId("login-code-help")).toHaveTextContent(
      `${t("login.codeHelpNeverSignedIn")} ${t("login.codeHelp")}`,
    );
  });

  it("hands the typed number to sign-up from the phone step too", async () => {
    await renderLogin();
    await fireEvent.changeText(
      screen.getByTestId("login-phone"),
      "06 12 34 56 78",
    );
    await fireEvent.press(screen.getByTestId("login-signup"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/signup",
      params: { phone: "+33612345678" },
    });
  });
});

describe("a code asked for just before the app closed (D3)", () => {
  it("reopens the code step on the resend gap, counting down its Retry-After", async () => {
    mockRequestOtp.mockRejectedValue(
      new AuthRequestError(t("login.errors.throttled"), 429, {
        errorCode: "TooManyRequests",
        retryAfter: 42,
      }),
    );
    await renderLogin();
    await sendCodeFor("06 12 34 56 78");

    expect(await screen.findByTestId("login-code-notice")).toHaveTextContent(
      t("login.codeStillValid"),
    );
    expect(screen.getByTestId("login-code-sent")).toHaveTextContent(
      "+33 6 12 34 56 78",
    );
    expect(screen.getByTestId("login-resend")).toHaveTextContent(
      t("login.resendIn", { seconds: 42 }),
    );
    expect(screen.queryByTestId("login-error")).toBeNull();
    // The app no longer knows when that code runs out: it says nothing rather than "0 minutes".
    expect(screen.queryByTestId("login-code-expiry")).toBeNull();
  });

  it.each(["OtpHourlyLimit", "NetworkThrottled", "SmsServiceBusy"])(
    "stays on the phone step for %s, where no code is waiting",
    async (errorCode) => {
      mockRequestOtp.mockRejectedValue(
        new AuthRequestError("wait", 429, { errorCode, retryAfter: 600 }),
      );
      await renderLogin();
      await sendCodeFor("06 12 34 56 78");

      expect(await screen.findByTestId("login-error")).toBeTruthy();
      expect(screen.getByTestId("login-phone")).toBeTruthy();
      expect(screen.queryByTestId("login-code-notice")).toBeNull();
    },
  );
});
