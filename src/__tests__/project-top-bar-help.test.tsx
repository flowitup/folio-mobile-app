/**
 * The request was precise: a question mark immediately before the notification bell. That
 * ordering lives in `ProjectTopBar`, so it is asserted here on the real component rather than on
 * a harness. `ProjectTopBar` backs Overview, Labor and Planning plus all three worker-mode tabs;
 * the Expenses tab draws its own header with no bell, and therefore no help mark either.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import i18n from "@/i18n";
import { HelpSheet } from "@/components/shell/help-sheet";
import { NotificationsSheet } from "@/components/shell/notifications-sheet";
import { ProjectTopBar } from "@/components/shell/project-top-bar";
import { ShellProvider } from "@/components/shell/shell-context";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      email: "chef@example.com",
      permissions: [],
      companies: [],
    },
  }),
}));

jest.mock("@/features/projects/selected-project", () => ({
  useSelectedProject: () => ({
    projectId: "p1",
    project: { id: "p1", name: "Villa Les Oliviers", my_permissions: [] },
    projects: [],
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    select: jest.fn(),
  }),
}));

jest.mock("@/features/notes/notes-api", () => ({
  useNotifications: () => ({ data: { items: [], attendance_pending: [] } }),
  useDismissNotification: () => ({ mutate: jest.fn(), isPending: false }),
}));

// Safe-area metrics the bar reads for its top inset. The width is inert here: React Native
// Testing Library runs no layout, so overflow cannot be observed in jsdom — what is asserted
// below is the structural guarantee that keeps the bar from overflowing, namely that both label
// lines truncate rather than grow.
const SMALL_PHONE: Metrics = {
  frame: { x: 0, y: 0, width: 320, height: 568 },
  insets: { top: 20, left: 0, right: 0, bottom: 0 },
};

/** testIDs in render order, so "before the bell" can be asserted rather than assumed. */
function testIdOrder(node: unknown, found: string[] = []): string[] {
  if (!node || typeof node !== "object") return found;
  const n = node as { props?: Record<string, unknown>; children?: unknown[] };
  const id = n.props?.testID;
  if (typeof id === "string") found.push(id);
  for (const child of n.children ?? []) testIdOrder(child, found);
  return found;
}

async function renderBar() {
  await i18n.changeLanguage("en");
  // The bell sheet issues its own queries, so it needs a client even though this suite
  // only cares that it is the bell — not the help mark — that opens it.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <SafeAreaProvider initialMetrics={SMALL_PHONE}>
      <QueryClientProvider client={queryClient}>
        <ShellProvider>
          <ProjectTopBar />
          <HelpSheet />
          <NotificationsSheet />
        </ShellProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe("ProjectTopBar help control", () => {
  it("renders the question mark immediately before the bell", async () => {
    await renderBar();

    const order = testIdOrder(screen.toJSON()).filter((id) =>
      id.startsWith("top-bar-"),
    );

    expect(order).toEqual([
      "top-bar-switcher",
      "top-bar-help",
      "top-bar-bell",
      "top-bar-account",
    ]);
  });

  it("labels the control for screen readers", async () => {
    await renderBar();

    expect(screen.getByTestId("top-bar-help").props.accessibilityLabel).toBe(
      i18n.t("help.open"),
    );
  });

  it("opens the help sheet, and leaves the bell doing its own job", async () => {
    await renderBar();

    await fireEvent.press(screen.getByTestId("top-bar-help"));
    expect(screen.getByTestId("help-sheet")).toBeTruthy();
    expect(screen.queryByTestId("notifications-sheet")).toBeNull();

    await fireEvent.press(screen.getByTestId("top-bar-bell"));
    expect(screen.getByTestId("notifications-sheet")).toBeTruthy();
  });

  it("keeps both label lines truncating, which is what stops a third control overflowing the bar", async () => {
    await renderBar();

    // The project name was already capped; the subtitle was not, and adding the help mark cut
    // its width budget by roughly a third on the narrowest supported phone.
    expect(screen.getByText("Villa Les Oliviers").props.numberOfLines).toBe(1);
    expect(
      screen.getByText(i18n.t("shell.switchProject")).props.numberOfLines,
    ).toBe(1);
  });
});
