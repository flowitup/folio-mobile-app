import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import ProjectChiffrageSection from "../../app/(app)/(tabs)/projects/[id]/chiffrage";
import {
  answerGet,
  ok,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";
import type { Persona } from "./helpers/release-qa-fixtures";

/**
 * Chiffrage write gating. Every chiffrage endpoint but the tree itself requires
 * `project:manage_invoices` (same gate as the web page's `canManage`), so a caller without it
 * reads the estimate and is offered no control that would 403. The rooms row is asserted here
 * too: it is a list of its own, not a detail of the shops row, so a room declared before any
 * shop exists must still be shown.
 */
let mockCurrent: Persona = persona("manager");

const TREE = {
  project_id: "p1",
  postes: [
    {
      id: "poste-1",
      project_id: "p1",
      name: "Carrelage",
      note: null,
      position: 0,
      articles: [
        {
          id: "art-1",
          poste_id: "poste-1",
          name: "Carreaux 60x60",
          quantity: 20,
          unit: "m2",
          room_id: "room-1",
          note: null,
          position: 0,
          quotes: [
            {
              id: "quote-1",
              article_id: "art-1",
              store_id: null,
              supplier_id: null,
              supplier_name: "Leroy Merlin",
              library_product_id: null,
              unit_price_ht: 30,
              tva_rate: 20,
              unit_price_ttc: 36,
              product_url: null,
              note: null,
              is_selected: true,
            },
          ],
          image: null,
          effective_source: "selected",
          total_ht: 600,
          total_ttc: 720,
        },
      ],
      store_baskets: [],
      room_subtotals: [],
      subtotal_ht: 600,
      subtotal_ttc: 720,
    },
  ],
  // A room declared while the project still has no shop at all.
  rooms: [{ id: "room-1", name: "Cuisine", position: 0 }],
  stores: [],
  store_baskets: [],
  total_ht: 600,
  total_ttc: 720,
  unpriced_article_count: 0,
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
  useAuth: () => ({ user: mockCurrent.user }),
}));

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: (...args: unknown[]) => mockPost(...args),
    PUT: (...args: unknown[]) => mockPut(...args),
    PATCH: (...args: unknown[]) => mockPatch(...args),
    DELETE: (...args: unknown[]) => mockDelete(...args),
  },
}));

const CHIFFRAGE_PATH = "/api/v1/projects/{project_id}/chiffrage";

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockImplementation(async (path: string, options?: unknown) => {
    if (path === CHIFFRAGE_PATH) return ok(TREE);
    if (path === `${CHIFFRAGE_PATH}/units`) return ok([]);
    // The library picker sheet is mounted with the write controls and reads the company
    // product library; an empty answer keeps it from throwing on an undefined payload.
    if (path.startsWith("/api/v1/bibliotheque")) return ok({ items: [] });
    return answerGet(() => mockCurrent)(path, options as never);
  });
});

describe("chiffrage write gating", () => {
  it("gives a manager every write control", async () => {
    mockCurrent = persona("manager");
    await renderWithProviders(<ProjectChiffrageSection />);

    expect(await screen.findByTestId("chiffrage-add-poste")).toBeTruthy();
    expect(screen.getByTestId("chiffrage-add-store")).toBeTruthy();
    expect(screen.getByTestId("chiffrage-add-room")).toBeTruthy();
    expect(screen.getByTestId("chiffrage-add-unit")).toBeTruthy();
    expect(screen.getByTestId("poste-add-article-poste-1")).toBeTruthy();

    // The per-quote controls live inside the expanded article.
    await fireEvent.press(screen.getByText("Carreaux 60x60"));
    expect(screen.getByTestId("article-add-quote-art-1")).toBeTruthy();
    expect(screen.getByTestId("quote-select-quote-1")).toBeTruthy();
    expect(screen.getByTestId("quote-delete-quote-1")).toBeTruthy();
  });

  it("hides every write control from a caller denied project:manage_invoices", async () => {
    mockCurrent = persona("manager", { deny: ["project:manage_invoices"] });
    await renderWithProviders(<ProjectChiffrageSection />);

    // The figures still load — reading the estimate is `project:read`.
    expect(await screen.findByText("Carrelage")).toBeTruthy();
    // Expand the article, so the per-quote controls would be on screen if they were rendered.
    await fireEvent.press(screen.getByText("Carreaux 60x60"));
    expect(screen.getByText(/Leroy Merlin/)).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByTestId("chiffrage-add-poste")).toBeNull(),
    );
    for (const testID of [
      "chiffrage-add-store",
      "chiffrage-add-room",
      "chiffrage-add-unit",
      "poste-add-article-poste-1",
      "article-add-quote-art-1",
      "quote-select-quote-1",
      "quote-delete-quote-1",
    ]) {
      expect(screen.queryByTestId(testID)).toBeNull();
    }
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("shows the rooms of a project that has no shop yet", async () => {
    mockCurrent = persona("manager");
    await renderWithProviders(<ProjectChiffrageSection />);

    // The chip used to be rendered inside the shops guard, so a room without a shop was
    // invisible and could be neither edited nor deleted.
    expect(await screen.findByTestId("chiffrage-room-room-1")).toBeTruthy();
    expect(screen.getByText("⌂ Cuisine")).toBeTruthy();
  });
});
