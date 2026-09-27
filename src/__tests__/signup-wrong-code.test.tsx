/**
 * Sign-up asks for the SMS code before the name, so a wrong code only surfaces on the last
 * step — and the screen has to send the user back to the code field. It used to recognise
 * that failure by looking for "code" in the message, which is translated: in Vietnamese (the
 * app's default language) nothing matched and the user stayed on the name step, retyping a
 * name that was never the problem. The 401 is what says "wrong code", in every language.
 */

import {
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

const mockSignUpWithOtp = jest.fn();
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    requestSignupOtp: jest.fn(async () => 300),
    signUpWithOtp: (...args: unknown[]) => mockSignUpWithOtp(...args),
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

beforeEach(() => jest.clearAllMocks());

/** Phone → code → name, stopping on the name step with everything filled in. */
async function reachNameStep() {
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <SignupScreen />
    </SafeAreaProvider>,
  );
  await fireEvent.changeText(
    screen.getByTestId("signup-phone"),
    "06 12 34 56 78",
  );
  await fireEvent.press(screen.getByTestId("signup-send-code"));
  await waitFor(() => screen.getByTestId("signup-code"));
  await fireEvent.changeText(screen.getByTestId("signup-code"), "000000");
  await fireEvent.press(screen.getByTestId("signup-code-next"));
  await fireEvent.changeText(screen.getByTestId("signup-name"), "Chef");
}

describe("signing up with a wrong code", () => {
  it("returns to the code step on a 401, whatever the language", async () => {
    await i18n.changeLanguage("vi");
    mockSignUpWithOtp.mockRejectedValue(
      new AuthRequestError(i18n.t("login.errors.invalidCode"), 401),
    );

    await reachNameStep();
    await fireEvent.press(screen.getByTestId("signup-create"));

    await waitFor(() => expect(screen.getByTestId("signup-code")).toBeTruthy());
    expect(screen.getByTestId("signup-error")).toHaveTextContent(
      i18n.t("login.errors.invalidCode"),
    );
  });

  it("keeps the user on the name step when the failure is not the code", async () => {
    await i18n.changeLanguage("vi");
    mockSignUpWithOtp.mockRejectedValue(
      new AuthRequestError(i18n.t("login.errors.throttled"), 429),
    );

    await reachNameStep();
    await fireEvent.press(screen.getByTestId("signup-create"));

    await waitFor(() => screen.getByTestId("signup-error"));
    expect(screen.getByTestId("signup-name")).toBeTruthy();
    expect(screen.queryByTestId("signup-code")).toBeNull();
  });
});
