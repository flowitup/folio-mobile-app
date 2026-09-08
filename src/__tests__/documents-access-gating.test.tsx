import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";
import type { ReactElement } from "react";

import "@/i18n";
import ProjectDocumentsSection from "../../app/(app)/(tabs)/projects/[id]/documents";
import { MenuSheet } from "@/components/shell/menu-sheet";

// D9: the documents area of a project — listing included — is closed to a caller without
// `project:update`. The scoped `my_permissions` of the project answer, not the JWT-wide list.
const PROJECT_ID = "p1";
const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let mockScopedPermissions: string[] = [];

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: "p1" }),
  useFocusEffect: () => undefined,
}));

// A company member: the JWT-wide list never carries `project:update`, the project row does.
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      email: "member@example.com",
      permissions: ["project:read", "user:read"],
      companies: [],
    },
  }),
}));

jest.mock("@/components/shell/shell-context", () => ({
  ...jest.requireActual("@/components/shell/shell-context"),
  useShell: () => ({
    sheet: "menu",
    closeSheet: jest.fn(),
    openSheet: jest.fn(),
    toggleSheet: jest.fn(),
    tabBarHeight: 0,
    setTabBarHeight: jest.fn(),
  }),
}));

jest.mock("@/features/projects/selected-project", () => ({
  useSelectedProject: () => ({
    projectId: "p1",
    project: { id: "p1", my_permissions: mockScopedPermissions },
    projects: [],
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    select: jest.fn(),
  }),
}));

const mockGet = jest.fn();
jest.mock("@/api/client", () => ({
  api: { GET: (...args: unknown[]) => mockGet(...args) },
}));

const mockAuthedFetch = jest.fn();
jest.mock("@/api/authed-fetch", () => ({
  authedFetch: (...args: unknown[]) => mockAuthedFetch(...args),
}));

function ok(data: unknown) {
  return { data, response: { status: 200, statusText: "OK" } };
}

async function renderWithProviders(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
    </SafeAreaProvider>,
  );
}

/** Resolves once the projects list (the source of the scoped permissions) has answered. */
async function projectsListLoaded() {
  await waitFor(() => expect(mockGet).toHaveBeenCalledWith("/api/v1/projects"));
}

beforeEach(() => {
  mockGet.mockReset();
  mockAuthedFetch.mockReset();
  mockAuthedFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ items: [], total: 0, page: 1, per_page: 25 }),
  });
  mockGet.mockImplementation(async (path: string) => {
    if (path === "/api/v1/projects")
      return ok({
        projects: [
          {
            id: PROJECT_ID,
            name: "Chantier",
            my_permissions: mockScopedPermissions,
          },
        ],
        total: 1,
      });
    if (path === "/api/v1/companies") return ok({ items: [] });
    if (path.endsWith("/documents/tags")) return ok({ tags: [] });
    if (path.endsWith("/members")) return ok({ members: [] });
    return ok({});
  });
});

describe("documents access (D9)", () => {
  describe("member without project:update", () => {
    beforeEach(() => {
      // `project:manage_labor` keeps the shell out of worker mode, so the Menu really does
      // list the project sections — the documents row must still be missing.
      mockScopedPermissions = ["project:read", "project:manage_labor"];
    });

    it("shows the restricted empty state and never requests the documents", async () => {
      await renderWithProviders(<ProjectDocumentsSection />);
      await projectsListLoaded();

      expect(screen.getByTestId("empty-state")).toBeTruthy();
      expect(
        screen.getByText("Documents are reserved for the project managers."),
      ).toBeTruthy();
      expect(screen.queryByTestId("documents-add")).toBeNull();
      expect(mockAuthedFetch).not.toHaveBeenCalled();
    });

    it("hides the documents row of the Menu sheet", async () => {
      await renderWithProviders(<MenuSheet />);

      expect(await screen.findByTestId("menu-section-notes")).toBeTruthy();
      expect(screen.queryByTestId("menu-section-documents")).toBeNull();
    });
  });

  describe("manager with project:update", () => {
    beforeEach(() => {
      mockScopedPermissions = [
        "project:read",
        "project:update",
        "project:manage_labor",
      ];
    });

    it("lists the documents and offers the upload button", async () => {
      await renderWithProviders(<ProjectDocumentsSection />);

      expect(await screen.findByTestId("documents-add")).toBeTruthy();
      await waitFor(() => expect(mockAuthedFetch).toHaveBeenCalled());
    });

    it("keeps the documents row of the Menu sheet", async () => {
      await renderWithProviders(<MenuSheet />);

      expect(await screen.findByTestId("menu-section-documents")).toBeTruthy();
    });
  });
});
