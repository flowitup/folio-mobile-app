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
 * QA round 3 on the chiffrage screen: shop totals say how much of a poste a shop covers and
 * skip shops that price nothing; the per-poste shop alias is gone; shops and rooms can be
 * deleted from their own sheet. (Fixture copied from the write-gating test.)
 *
 * Original note, chiffrage write gating. Every chiffrage endpoint but the tree itself requires
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
      store_baskets: [
        {
          store_id: "s1",
          basket_ht: 21.25,
          basket_ttc: 25.5,
          priced_article_count: 1,
          total_article_count: 2,
          missing_article_ids: ["art-2"],
          covers_all: false,
        },
        {
          store_id: "s2",
          basket_ht: 0,
          basket_ttc: 0,
          priced_article_count: 0,
          total_article_count: 2,
          missing_article_ids: ["art-1", "art-2"],
          covers_all: false,
        },
      ],
      room_subtotals: [],
      subtotal_ht: 600,
      subtotal_ttc: 720,
    },
  ],
  // A room declared while the project still has no shop at all.
  rooms: [{ id: "room-1", name: "Cuisine", position: 0 }],
  stores: [
    {
      id: "s1",
      project_id: "p1",
      name: "Point P",
      address: null,
      website_url: null,
      position: 0,
    },
    {
      id: "s2",
      project_id: "p1",
      name: "Brico Dépôt",
      address: null,
      website_url: null,
      position: 1,
    },
  ],
  store_baskets: [
    {
      store_id: "s1",
      basket_ht: 21.25,
      basket_ttc: 25.5,
      priced_article_count: 1,
      total_article_count: 2,
      missing_article_ids: ["art-2"],
      covers_all: false,
    },
    {
      store_id: "s2",
      basket_ht: 0,
      basket_ttc: 0,
      priced_article_count: 0,
      total_article_count: 2,
      missing_article_ids: ["art-1", "art-2"],
      covers_all: false,
    },
  ],
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

describe("chiffrage shops (QA round 3)", () => {
  it("shows partial coverage on the poste line and skips a shop with no price", async () => {
    mockCurrent = persona("manager");
    await renderWithProviders(<ProjectChiffrageSection />);

    const line = await screen.findByTestId("poste-baskets-poste-1");
    expect(line).toHaveTextContent(/Point P .*\(1\/2 \S+\)/);
    expect(line).not.toHaveTextContent(/Brico Dépôt/);
    // The shop chip is still there; only its empty "0.00" basket is gone.
    expect(screen.getByTestId("chiffrage-store-s2")).toBeTruthy();
    expect(screen.queryByText(/Brico Dépôt: /)).toBeNull();
  });

  it("no longer offers a per-poste shop", async () => {
    mockCurrent = persona("manager");
    await renderWithProviders(<ProjectChiffrageSection />);
    expect(await screen.findByTestId("poste-add-article-poste-1")).toBeTruthy();
    for (const label of ["Shop for this section", "Magasin pour ce poste"])
      expect(screen.queryByText(label)).toBeNull();
  });

  it("deletes a shop from its edit sheet after confirmation", async () => {
    mockCurrent = persona("manager");
    mockDelete.mockResolvedValue(ok({}));
    await renderWithProviders(<ProjectChiffrageSection />);

    await fireEvent.press(await screen.findByTestId("chiffrage-store-s1"));
    await fireEvent.press(await screen.findByTestId("chiffrage-sheet-delete"));
    await fireEvent.press(screen.getByTestId("confirm-ok"));
    await waitFor(() => expect(mockDelete).toHaveBeenCalled());
    expect(mockDelete.mock.calls[0][0]).toContain("stores");
  });
});
