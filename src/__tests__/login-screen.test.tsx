import { screen } from "@testing-library/react-native";

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

/**
 * Guards the email-removal half of the sign-in screen. The phone flow itself —
 * steps, code boxes, countdown, auto-submit — is covered by
 * login-ink-sheet.test.tsx; this file only asserts what must never come back.
 */
describe("login screen — email sign-in removed", () => {
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
});
