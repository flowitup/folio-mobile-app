import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { renderWithProviders } from "./helpers/release-qa-fixtures";

import LoginScreen from "../../app/(auth)/index";

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
let mockPhoneParam: string | undefined;
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ phone: mockPhoneParam }),
}));

beforeEach(() => {
  mockSignup = true;
  mockPhoneParam = undefined;
  mockRequestOtp.mockReset();
  mockSignInWithOtp.mockReset();
  mockPush.mockReset();
});

describe("login screen", () => {
  it("shows only the phone form — no mode switcher and no email/password fields", async () => {
    await renderWithProviders(<LoginScreen />);

    expect(await screen.findByTestId("login-phone")).toBeTruthy();
    expect(screen.queryByTestId("login-mode")).toBeNull();
    expect(screen.queryByTestId("login-email")).toBeNull();
    expect(screen.queryByTestId("login-password")).toBeNull();
  });

  it("offers to create an account only when the backend enables signup", async () => {
    mockSignup = false;
    await renderWithProviders(<LoginScreen />);

    expect(await screen.findByTestId("login-phone")).toBeTruthy();
    expect(screen.queryByTestId("login-signup")).toBeNull();
  });

  it("pre-fills the phone field from a `phone` route param (accept-invite hand-off)", async () => {
    mockPhoneParam = "+33612345678";
    await renderWithProviders(<LoginScreen />);

    expect((await screen.findByTestId("login-phone")).props.value).toBe(
      "+33612345678",
    );
  });

  it("sends a code for the typed phone and moves to code entry", async () => {
    mockRequestOtp.mockResolvedValue(300);
    await renderWithProviders(<LoginScreen />);

    await fireEvent.changeText(
      screen.getByTestId("login-phone"),
      "06 12 34 56 78",
    );
    await fireEvent.press(screen.getByTestId("login-send-code"));

    await waitFor(() =>
      expect(mockRequestOtp).toHaveBeenCalledWith("+33612345678"),
    );
    expect(await screen.findByTestId("login-code")).toBeTruthy();
  });
});
