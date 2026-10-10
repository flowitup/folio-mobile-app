import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "@/i18n";
import { ProjectTopBar } from "@/components/shell/project-top-bar";
import { ShellProvider } from "@/components/shell/shell-context";

/** The bell dot also lights for unread activity, and not for entries already read. */
let mockEvents: { id: string; read: boolean }[] = [];

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/",
  useFocusEffect: (cb: () => undefined | (() => void)) => {
    cb();
  },
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
    project: { id: "p1", name: "Villa", my_permissions: [] },
    projects: [],
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    select: jest.fn(),
  }),
}));
jest.mock("@/features/notes/notes-api", () => ({
  useNotifications: () => ({
    data: { items: [], attendance_pending: [], events: mockEvents },
  }),
}));

function renderBar() {
  const queryClient = new QueryClient();
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 800 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ShellProvider>
          <ProjectTopBar />
        </ShellProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe("top bar bell · activity", () => {
  it("shows the dot for an unread entry", async () => {
    mockEvents = [{ id: "e1", read: false }];
    await renderBar();
    expect(screen.getByTestId("top-bar-bell-dot")).toBeTruthy();
  });

  it("shows no dot when every entry is read", async () => {
    mockEvents = [{ id: "e1", read: true }];
    await renderBar();
    expect(screen.queryByTestId("top-bar-bell-dot")).toBeNull();
  });
});
