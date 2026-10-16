import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import i18n from "@/i18n";
import { ok, renderWithProviders } from "./helpers/release-qa-fixtures";

import ProjectDocumentsSection from "../../app/(app)/(tabs)/projects/[id]/documents";

/**
 * QA round 3 (documents): a delete that empties the last page falls back to the page before
 * instead of "No documents." with the pager hidden; a picture opens in the in-app viewer with a
 * thumbnail in the list; a file the API would refuse is named in the error, not sent.
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
const mockShowToast = jest.fn();
jest.mock("@/components/ui/toast", () => ({
  ...jest.requireActual("@/components/ui/toast"),
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));
jest.mock("@/components/ui/authed-image", () => {
  const { View } = jest.requireActual("react-native");
  return {
    AuthedImage: ({ testID }: { testID?: string }) => <View testID={testID} />,
  };
});
const mockPickDocuments = jest.fn();
jest.mock("@/lib/files/pick", () => ({
  ...jest.requireActual("@/lib/files/pick"),
  pickDocuments: (...args: unknown[]) => mockPickDocuments(...args),
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
  mockShowToast.mockReset();
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

function listResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function documentsAt(pages: Record<string, unknown>) {
  mockAuthedFetch.mockImplementation(async (url: string) => {
    if (!String(url).includes("/documents?")) return listResponse({});
    const page = /[?&]page=(\d+)/.exec(String(url))?.[1] ?? "1";
    return listResponse(pages[page]);
  });
}

describe("documents list", () => {
  it("falls back to the last page that still exists after a delete", async () => {
    // Page 1 still counts 26 documents; by the time page 2 loads, its only one was deleted.
    documentsAt({
      "1": { items: [DOCUMENT], total: 26, page: 1, per_page: 25 },
      "2": { items: [], total: 25, page: 2, per_page: 25 },
    });
    await renderWithProviders(<ProjectDocumentsSection />);
    await fireEvent.press(await screen.findByTestId("documents-next"));

    await waitFor(() =>
      expect(
        mockAuthedFetch.mock.calls.filter(([url]) =>
          /\/documents\?.*page=2/.test(String(url)),
        ).length,
      ).toBeGreaterThan(0),
    );
    // Back on page 1, the remaining document is listed, not "No documents."
    await waitFor(() =>
      expect(
        String(mockAuthedFetch.mock.calls.at(-1)?.[0]).includes("page=2"),
      ).toBe(false),
    );
    expect(await screen.findByText("plan.pdf")).toBeTruthy();
    expect(screen.queryByText(i18n.t("documents.none"))).toBeNull();
  });

  it("opens a picture in the in-app viewer, with a thumbnail in the list", async () => {
    const photo = {
      ...DOCUMENT,
      id: "d2",
      filename: "facade.jpg",
      content_type: "image/jpeg",
      kind: "image",
    };
    documentsAt({ "1": { items: [photo], total: 1, page: 1, per_page: 25 } });
    await renderWithProviders(<ProjectDocumentsSection />);

    expect(await screen.findByTestId("document-thumb-d2")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("document-open-d2"));
    expect(await screen.findByTestId("image-viewer")).toBeTruthy();
    expect(screen.getByTestId("image-viewer-share")).toBeTruthy();
  });

  it("offers only the accepted types and names a refused file", async () => {
    documentsAt({
      "1": { items: [DOCUMENT], total: 1, page: 1, per_page: 25 },
    });
    mockPickDocuments.mockResolvedValue({
      status: "picked",
      files: [
        {
          uri: "file:///a",
          name: "ancien format.doc",
          mimeType: "application/msword",
          size: 10,
        },
        {
          uri: "file:///b",
          name: "vide.pdf",
          mimeType: "application/pdf",
          size: 0,
        },
      ],
    });
    await renderWithProviders(<ProjectDocumentsSection />);
    await fireEvent.press(await screen.findByTestId("documents-file"));

    await waitFor(() => expect(mockShowToast).toHaveBeenCalled());
    const [types] = mockPickDocuments.mock.calls[0].slice(1);
    expect(types).not.toContain("*/*");
    expect(types).toContain("application/pdf");
    const message = mockShowToast.mock.calls[0][0] as string;
    expect(message).toContain("ancien format.doc: .doc files are not accepted");
    expect(message).toContain("vide.pdf: the file is empty.");
    expect(
      mockAuthedFetch.mock.calls.some(([, init]) => init?.method === "POST"),
    ).toBe(false);
  });
});
