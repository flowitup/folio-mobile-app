import { render, waitFor } from "@testing-library/react-native";

import TabsLayout from "../../app/(app)/(tabs)/_layout";

/**
 * The hidden tab routes (project sections, invoice detail) are tab screens: a back press from
 * their first screen is handled by the Tabs navigator. With the default "firstRoute" it landed
 * on Overview instead of the tab the user came from (e.g. Expenses); "history" keeps that tab.
 */
jest.mock("expo-router", () => {
  const Tabs = jest.fn(() => null) as jest.Mock & { Screen: () => null };
  Tabs.Screen = function Screen() {
    return null;
  };
  return { Tabs };
});

jest.mock("@/components/shell/account-sheet", () => ({
  AccountSheet: () => null,
}));
jest.mock("@/components/shell/chat-fab", () => ({ ChatFab: () => null }));
jest.mock("@/components/shell/help-sheet", () => ({ HelpSheet: () => null }));
jest.mock("@/components/shell/menu-sheet", () => ({ MenuSheet: () => null }));
jest.mock("@/components/shell/notifications-sheet", () => ({
  NotificationsSheet: () => null,
}));
jest.mock("@/components/shell/project-switcher-sheet", () => ({
  ProjectSwitcherSheet: () => null,
}));
jest.mock("@/components/shell/shell-context", () => ({
  ShellProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/features/projects/selected-project", () => ({
  SelectedProjectProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));
jest.mock("@/theme/tokens", () => ({ useTokens: () => ({ paper: "#fff" }) }));

test("back from a hidden tab route returns to the previous tab, not Overview", async () => {
  render(<TabsLayout />);
  const { Tabs } = jest.requireMock("expo-router") as { Tabs: jest.Mock };
  await waitFor(() => expect(Tabs).toHaveBeenCalled());
  expect(Tabs.mock.calls[0][0]).toMatchObject({ backBehavior: "history" });
});
