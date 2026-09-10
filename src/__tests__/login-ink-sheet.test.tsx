import {
  fireEvent,
  render,
  screen,
  userEvent,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import i18n from "@/i18n";
import LoginScreen from "../../app/(auth)/index";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let mockLoginMode: "phone" | "email" | "both" = "phone";
jest.mock("@/auth/auth-config", () => ({
  ...jest.requireActual("@/auth/auth-config"),
  useAuthConfig: () => ({
    data: { login_mode: mockLoginMode, session: "expiring", signup: false },
  }),
}));

const mockRequestOtp = jest.fn();
const mockSignInWithOtp = jest.fn();
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    requestOtp: (...args: unknown[]) => mockRequestOtp(...args),
    signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
    signIn: jest.fn(),
  }),
}));

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

/** `i18n.t` rather than literals: the app's default locale is Vietnamese. */
const t = (key: string, values?: Record<string, unknown>) =>
  i18n.t(key, values) as string;

/** RNTL 14's `render` is async: `screen` is only populated once it resolves. */
async function renderLogin() {
  return await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <LoginScreen />
    </SafeAreaProvider>,
  );
}

describe("Login — ink header + paper sheet (design 2c / 2d)", () => {
  beforeEach(() => {
    mockLoginMode = "phone";
    mockRequestOtp.mockReset().mockResolvedValue(300);
    mockSignInWithOtp.mockReset().mockResolvedValue(undefined);
  });

  it("opens on the phone step stating the dial code, with sending refused", async () => {
    await renderLogin();

    expect(screen.getByText(t("login.title"))).toBeTruthy();
    expect(screen.getByText(t("login.subtitle"))).toBeTruthy();
    // Codes only leave through a French gateway, so the chip states +33.
    expect(screen.getByText("FR")).toBeTruthy();
    expect(screen.getByText("+33")).toBeTruthy();
    expect(screen.getByText(t("login.phoneHint"))).toBeTruthy();
    expect(screen.getByTestId("login-send-code")).toBeDisabled();
  });

  it("enables the button once the number reads as French, and sends E.164", async () => {
    const user = userEvent.setup();
    await renderLogin();

    await user.type(screen.getByTestId("login-phone"), "0612345678");
    expect(screen.getByTestId("login-send-code")).not.toBeDisabled();

    await user.press(screen.getByTestId("login-send-code"));
    expect(mockRequestOtp).toHaveBeenCalledWith("+33612345678");
  });

  it("never offers to send a number from another country", async () => {
    const user = userEvent.setup();
    await renderLogin();

    await user.type(screen.getByTestId("login-phone"), "+84912345678");

    expect(screen.getByTestId("login-send-code")).toBeDisabled();
    expect(mockRequestOtp).not.toHaveBeenCalled();
  });

  it("shows the six code boxes, the countdown and the expiry after a code is sent", async () => {
    const user = userEvent.setup();
    await renderLogin();

    await user.type(screen.getByTestId("login-phone"), "0612345678");
    await user.press(screen.getByTestId("login-send-code"));

    expect(screen.getByText(t("login.codeTitle"))).toBeTruthy();
    expect(screen.getByTestId("login-code-sent")).toHaveTextContent(
      "+33612345678",
    );
    for (let index = 0; index < 6; index += 1) {
      expect(screen.getByTestId(`login-code-${index}`)).toBeTruthy();
    }
    expect(screen.getByText(t("login.resendIn", { seconds: 60 }))).toBeTruthy();
    // 300 s is what the mocked request reports, so the sheet quotes 5 minutes.
    expect(
      screen.getByText(t("login.codeExpires", { minutes: 5 })),
    ).toBeTruthy();
    // The countdown is running, so asking for another code is refused.
    expect(screen.getByTestId("login-resend")).toBeDisabled();
  });

  it("signs in on its own once the sixth digit is typed", async () => {
    const user = userEvent.setup();
    await renderLogin();

    await user.type(screen.getByTestId("login-phone"), "0612345678");
    await user.press(screen.getByTestId("login-send-code"));

    for (const [index, digit] of [..."482917"].entries()) {
      await fireEvent.changeText(
        screen.getByTestId(`login-code-${index}`),
        digit,
      );
    }

    expect(mockSignInWithOtp).toHaveBeenCalledWith("+33612345678", "482917");
  });

  it("spreads a whole code handed to the first box, as a platform autofill does", async () => {
    const user = userEvent.setup();
    await renderLogin();

    await user.type(screen.getByTestId("login-phone"), "0612345678");
    await user.press(screen.getByTestId("login-send-code"));
    await fireEvent.changeText(screen.getByTestId("login-code-0"), "482917");

    expect(screen.getByTestId("login-code-3")).toHaveDisplayValue("9");
    expect(mockSignInWithOtp).toHaveBeenCalledWith("+33612345678", "482917");
  });

  it("keeps the digits and offers a retry when the code is rejected", async () => {
    mockSignInWithOtp.mockRejectedValue(new Error("Wrong code"));
    const user = userEvent.setup();
    await renderLogin();

    await user.type(screen.getByTestId("login-phone"), "0612345678");
    await user.press(screen.getByTestId("login-send-code"));
    await fireEvent.changeText(screen.getByTestId("login-code-0"), "482917");

    expect(screen.getByTestId("login-error")).toBeTruthy();
    expect(screen.getByTestId("login-code-5")).toHaveDisplayValue("7");
    expect(screen.getByText(t("login.retry"))).toBeTruthy();
  });

  it("comes back to the phone step from the header pill", async () => {
    const user = userEvent.setup();
    await renderLogin();

    await user.type(screen.getByTestId("login-phone"), "0612345678");
    await user.press(screen.getByTestId("login-send-code"));
    await user.press(screen.getByTestId("login-change-phone"));

    expect(screen.getByTestId("login-phone")).toHaveDisplayValue("0612345678");
    expect(screen.getByText(t("login.title"))).toBeTruthy();
  });
});
