import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import i18n from "@/i18n";
import { ok, renderWithProviders } from "./helpers/release-qa-fixtures";

import ProjectDocumentsSection from "../../app/(app)/(tabs)/projects/[id]/documents";

/**
 * Saving the document edit sheet renames first, then sets the tags. A refused rename used to
 * be swallowed: the tags were still saved and the sheet closed, losing the typed name.
 */
const PROJECT_ID = "p1";
const SCOPED = ["project:read", "project:update"];
const DOCUMENT = {
  id: "d1",
  project_id: PROJECT_ID,
  filename: "plan.pdf",
  content_type: "application/pdf",
  size_bytes: 2048,
  kind: "pdf",
  uploaded_at: "2026-09-20T08:00:00Z",
  uploader_id: "u1",
  download_url: "/x",
  tags: [],
};

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: "p1" }),
  useFocusEffect: () => undefined,
}));
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      email: "manager@example.com",
      permissions: ["project:read", "project:update", "user:read"],
      companies: [],
    },
  }),
}));
jest.mock("@/features/projects/selected-project", () => ({
  useSelectedProject: () => ({
    projectId: "p1",
    project: { id: "p1", my_permissions: SCOPED },
    projects: [],
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    select: jest.fn(),
  }),
}));

const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockPut = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    PATCH: (...args: unknown[]) => mockPatch(...args),
    PUT: (...args: unknown[]) => mockPut(...args),
  },
}));
const mockAuthedFetch = jest.fn();
jest.mock("@/api/authed-fetch", () => ({
  authedFetch: (...args: unknown[]) => mockAuthedFetch(...args),
}));

beforeEach(async () => {
  await i18n.changeLanguage("en");
  mockGet.mockReset();
  mockPatch.mockReset();
  mockPut.mockReset();
  mockAuthedFetch.mockReset();
  mockAuthedFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ items: [DOCUMENT], total: 1, page: 1, per_page: 25 }),
  });
  mockGet.mockImplementation(async (path: string) => {
    if (path === "/api/v1/projects")
      return ok({
        projects: [
          { id: PROJECT_ID, name: "Chantier", my_permissions: SCOPED },
        ],
        total: 1,
      });
    if (path === "/api/v1/companies") return ok({ items: [] });
    if (path.endsWith("/documents/tags")) return ok({ tags: [] });
    if (path.endsWith("/members")) return ok({ members: [] });
    return ok({});
  });
  mockPatch.mockResolvedValue({
    error: { error: "Conflict", message: "A document with that name exists" },
    response: { status: 409, statusText: "Conflict" },
  });
  mockPut.mockResolvedValue(ok({ ...DOCUMENT, tags: ["lot-2"] }));
});

describe("document edit sheet", () => {
  it("keeps the typed name and skips the tags when the rename is refused", async () => {
    await renderWithProviders(<ProjectDocumentsSection />);
    await fireEvent.press(await screen.findByTestId("document-edit-d1"));
    await fireEvent.changeText(
      screen.getByTestId("document-name"),
      "plan-v2.pdf",
    );
    await fireEvent.changeText(screen.getByTestId("document-tags"), "lot-2");
    await fireEvent.press(screen.getByTestId("document-save"));

    await waitFor(() => expect(mockPatch).toHaveBeenCalled());
    expect(
      await screen.findAllByText("A document with that name exists"),
    ).not.toHaveLength(0);
    expect(mockPut).not.toHaveBeenCalled();
    expect(screen.getByTestId("document-name").props.value).toBe("plan-v2.pdf");
  });
});
