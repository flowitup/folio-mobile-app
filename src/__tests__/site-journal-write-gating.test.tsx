import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";
import type { ReactElement } from "react";

import "@/i18n";
import ProjectAnalysesSection from "../../app/(app)/(tabs)/projects/[id]/analyses";
import ProjectNotesSection from "../../app/(app)/(tabs)/projects/[id]/notes";
import ProjectPhotosSection from "../../app/(app)/(tabs)/projects/[id]/photos";

// D9: notes, analyses and photos stay readable for a member; every write control (create,
// edit, delete, upload) needs `project:update` on the project.
const PROJECT_ID = "p1";
const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const NOTE = {
  id: "n1",
  project_id: PROJECT_ID,
  created_by: "u2",
  title: "Livraison béton",
  description: null,
  category: "delivery",
  status: "open",
  created_at: "2026-03-02T08:00:00Z",
  updated_at: "2026-03-02T08:00:00Z",
};

const ANALYSIS = {
  id: "a1",
  project_id: PROJECT_ID,
  title: "Rapport thermique",
  summary: null,
  source_url: null,
  tags: [],
  size_bytes: 2048,
  created_at: "2026-03-02T08:00:00Z",
};

let mockScopedPermissions: string[] = [];

// The analyses viewer needs the native WebView module, which no Jest binary carries; the
// report renderer is not what these tests assert on.
jest.mock("react-native-webview", () => ({ WebView: () => null }));

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

const mockGet = jest.fn();
jest.mock("@/api/client", () => ({
  api: { GET: (...args: unknown[]) => mockGet(...args) },
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

beforeEach(() => {
  mockGet.mockReset();
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
    if (path.endsWith("/notes")) return ok({ items: [NOTE] });
    if (path.endsWith("/analyses")) return ok({ items: [ANALYSIS], total: 1 });
    if (path.endsWith("/analyses/tags")) return ok({ tags: [] });
    if (path.endsWith("/photos"))
      return ok({ items: [], total: 0, page: 1, per_page: 60 });
    return ok({});
  });
});

describe("site journal write controls (D9)", () => {
  describe("member without project:update", () => {
    beforeEach(() => {
      mockScopedPermissions = ["project:read"];
    });

    it("keeps the notes readable but hides create, done-toggle and delete", async () => {
      await renderWithProviders(<ProjectNotesSection />);

      expect(await screen.findByTestId(`note-${NOTE.id}`)).toBeTruthy();
      expect(screen.queryByTestId("notes-create")).toBeNull();
      expect(screen.queryByTestId(`note-toggle-${NOTE.id}`)).toBeNull();
      expect(screen.queryByTestId(`note-delete-${NOTE.id}`)).toBeNull();
      expect(screen.queryByTestId("note-submit")).toBeNull();
    });

    it("keeps the analyses readable but hides upload, edit and delete", async () => {
      await renderWithProviders(<ProjectAnalysesSection />);

      expect(
        await screen.findByTestId(`analysis-open-${ANALYSIS.id}`),
      ).toBeTruthy();
      expect(screen.queryByTestId("analyses-create")).toBeNull();
      expect(screen.queryByTestId(`analysis-edit-${ANALYSIS.id}`)).toBeNull();
      expect(screen.queryByTestId(`analysis-delete-${ANALYSIS.id}`)).toBeNull();
      expect(screen.queryByTestId("analysis-submit")).toBeNull();
    });

    it("hides the photo upload button and its picker sheet", async () => {
      await renderWithProviders(<ProjectPhotosSection />);

      await waitFor(() =>
        expect(mockGet).toHaveBeenCalledWith("/api/v1/projects"),
      );
      expect(screen.queryByTestId("photos-add")).toBeNull();
      expect(screen.queryByTestId("photos-camera")).toBeNull();
      expect(screen.queryByTestId("photos-library")).toBeNull();
    });
  });

  describe("manager with project:update", () => {
    beforeEach(() => {
      mockScopedPermissions = ["project:read", "project:update"];
    });

    it("offers the note create button and the per-note actions", async () => {
      await renderWithProviders(<ProjectNotesSection />);

      expect(await screen.findByTestId("notes-create")).toBeTruthy();
      expect(await screen.findByTestId(`note-toggle-${NOTE.id}`)).toBeTruthy();
      expect(screen.getByTestId(`note-delete-${NOTE.id}`)).toBeTruthy();
      expect(screen.getByTestId("note-submit")).toBeTruthy();
    });

    it("offers the analysis upload button and the per-report actions", async () => {
      await renderWithProviders(<ProjectAnalysesSection />);

      expect(await screen.findByTestId("analyses-create")).toBeTruthy();
      expect(
        await screen.findByTestId(`analysis-edit-${ANALYSIS.id}`),
      ).toBeTruthy();
      expect(screen.getByTestId(`analysis-delete-${ANALYSIS.id}`)).toBeTruthy();
      expect(screen.getByTestId("analysis-submit")).toBeTruthy();
    });

    it("offers the photo upload button and its picker sheet", async () => {
      await renderWithProviders(<ProjectPhotosSection />);

      expect(await screen.findByTestId("photos-add")).toBeTruthy();
      expect(screen.getByTestId("photos-camera")).toBeTruthy();
      expect(screen.getByTestId("photos-library")).toBeTruthy();
    });
  });
});
