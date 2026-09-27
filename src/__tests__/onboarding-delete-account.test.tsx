/**
 * A brand-new account that has not joined a company never reaches the account sheet —
 * the onboarding gate and the waiting screen are dead ends whose only other exit is
 * sign-out. An App Store reviewer who signs up and stops there has to be able to
 * delete the account from exactly those screens, so both carry the same entry point.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import OnboardingScreen from "@/../app/(app)/onboarding";
import OnboardingWaitingScreen from "@/../app/(app)/onboarding-waiting";
import i18n from "@/i18n";

jest.mock("@/auth/auth-context", () => ({
  AccountDeletionBlockedError: class extends Error {},
  useAuth: () => ({
    user: {
      id: "u1",
      email: "new@example.com",
      permissions: [],
      companies: [],
    },
    signOut: jest.fn(),
    deleteAccount: jest.fn(),
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

async function renderScreen(Screen: () => React.JSX.Element) {
  await i18n.changeLanguage("fr");
  // RNTL 14 resolves `render` asynchronously here.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return await render(
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <Screen />
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
}

describe("account deletion is reachable before a company exists", () => {
  it("offers it on the onboarding gate", async () => {
    await renderScreen(OnboardingScreen);

    expect(screen.getByTestId("onboarding-delete-account")).toBeTruthy();
    expect(screen.getByText("Supprimer mon compte")).toBeTruthy();
  });

  it("offers it on the waiting screen", async () => {
    await renderScreen(OnboardingWaitingScreen);

    expect(
      screen.getByTestId("onboarding-waiting-delete-account"),
    ).toBeTruthy();
    expect(screen.getByText("Supprimer mon compte")).toBeTruthy();
  });
});
