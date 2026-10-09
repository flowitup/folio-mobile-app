/**
 * The account sheet lists every company the signed-in user belongs to. The lines used to be
 * joined with "\n" inside one `numberOfLines={1}` Text, so only the first company was laid out
 * and every other one was cut silently.
 */

import { fireEvent, render, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import { AccountSheet } from "@/components/shell/account-sheet";
import { ShellProvider, useShell } from "@/components/shell/shell-context";
import i18n from "@/i18n";

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      email: "joiner@example.com",
      display_name: "Joiner",
      permissions: [],
      companies: [
        { id: "c1", legal_name: "Co A", role: "manager" },
        { id: "c2", legal_name: "Co B", role: "admin" },
      ],
    },
    signOut: jest.fn(),
    deleteAccount: jest.fn(),
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/",
}));

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function OpenAccount() {
  const { openSheet } = useShell();
  return (
    <Pressable testID="open-account" onPress={() => openSheet("account")}>
      <Text>open</Text>
    </Pressable>
  );
}

describe("AccountSheet — companies", () => {
  it("shows every company on its own line", async () => {
    await i18n.changeLanguage("en");
    await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <ShellProvider>
          <OpenAccount />
          <AccountSheet />
        </ShellProvider>
      </SafeAreaProvider>,
    );
    await fireEvent.press(screen.getByTestId("open-account"));

    const first = screen.getByText("Co A · Manager");
    const second = screen.getByText("Co B · Admin");
    expect(first.props.numberOfLines).toBe(1);
    expect(second.props.numberOfLines).toBe(1);
  });
});
