/**
 * Sign-up: "Change number" then "Send code" for the same number within the 60-second resend
 * gap asked the backend for a second code, which answers 429 — the user stayed on the phone
 * step although the code already texted was still valid. Like the sign-in screen
 * (hasCodeInFlight), the code step reopens without a new request.
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

import "@/i18n";
import SignupScreen from "../../app/(auth)/signup";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const mockRequestSignupOtp = jest.fn(async (_phone: string) => 300);
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    requestSignupOtp: (phone: string) => mockRequestSignupOtp(phone),
    signUpWithOtp: jest.fn(),
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

beforeEach(() => mockRequestSignupOtp.mockClear());
afterEach(() => jest.useRealTimers());

async function sendFor(phone: string) {
  await fireEvent.changeText(screen.getByTestId("signup-phone"), phone);
  await fireEvent.press(screen.getByTestId("signup-send-code"));
  await waitFor(() => screen.getByTestId("signup-code"));
}

async function changeNumber() {
  await fireEvent.press(screen.getByTestId("signup-change-phone"));
  await waitFor(() => screen.getByTestId("signup-phone"));
}

async function renderScreen() {
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <SignupScreen />
    </SafeAreaProvider>,
  );
}

describe("sign-up: change number, then the same number again", () => {
  it("reopens the code step without asking for a second code", async () => {
    await renderScreen();
    await sendFor("06 12 34 56 78");
    await changeNumber();

    await sendFor("06 12 34 56 78");

    expect(mockRequestSignupOtp).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("signup-code-sent")).toHaveTextContent(
      "+33612345678",
    );
    expect(screen.queryByTestId("signup-error")).toBeNull();
  });

  it("still sends a code to a different number at once", async () => {
    await renderScreen();
    await sendFor("06 12 34 56 78");
    await changeNumber();

    await sendFor("06 98 76 54 32");

    expect(mockRequestSignupOtp).toHaveBeenCalledTimes(2);
    expect(mockRequestSignupOtp).toHaveBeenLastCalledWith("+33698765432");
  });

  it("asks again for the same number once the resend gap is over", async () => {
    jest.useFakeTimers();
    await renderScreen();
    await sendFor("06 12 34 56 78");
    await changeNumber();

    await act(async () => {
      jest.advanceTimersByTime(61_000);
    });
    await sendFor("06 12 34 56 78");

    expect(mockRequestSignupOtp).toHaveBeenCalledTimes(2);
  });
});
