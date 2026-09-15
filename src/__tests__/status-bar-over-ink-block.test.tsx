/**
 * The ink block keeps its DARK values in both palettes, so on those screens the clock
 * and battery sit on near-black whatever the theme says. `StatusBar style="auto"`
 * picks from the color scheme rather than from what is actually behind the bar, so
 * once the app defaulted to the light palette the glyphs went dark-on-dark —
 * measured at 1.13:1 on a Pixel 7 emulator, against the 4.5:1 WCAG AA floor.
 *
 * Asserted here as a prop rather than a pixel: jsdom runs no layout and has no status
 * bar, so what is guarded is the rule — an ink header declares light, a paper header
 * leaves the choice to the scheme.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import { ProjectTopBar } from "@/components/shell/project-top-bar";
import { ShellProvider } from "@/components/shell/shell-context";
import i18n from "@/i18n";

const statusBarStyles: (string | undefined)[] = [];

jest.mock("expo-status-bar", () => ({
  StatusBar: (props: { style?: string }) => {
    statusBarStyles.push(props.style);
    return null;
  },
}));

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
    project: { id: "p1", name: "Chantier Arcueil", my_permissions: [] },
    isPending: false,
  }),
}));

jest.mock("@/features/notes/notes-api", () => ({
  useNotifications: () => ({ data: { items: [], attendance_pending: [] } }),
  useDismissNotification: () => ({ mutate: jest.fn(), isPending: false }),
}));

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 20, left: 0, right: 0, bottom: 0 },
};

async function renderBar(tone?: "ink") {
  await i18n.changeLanguage("en");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <QueryClientProvider client={queryClient}>
        <ShellProvider>
          {tone ? <ProjectTopBar tone={tone} /> : <ProjectTopBar />}
        </ShellProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe("status bar over the project top bar", () => {
  beforeEach(() => {
    statusBarStyles.length = 0;
  });

  it("asks for light glyphs when the header is the ink block", async () => {
    await renderBar("ink");

    expect(statusBarStyles).toContain("light");
    expect(statusBarStyles).not.toContain("dark");
  });

  it("leaves the choice to the color scheme on a paper header", async () => {
    await renderBar();

    expect(statusBarStyles).toContain("auto");
    expect(statusBarStyles).not.toContain("light");
  });
});
