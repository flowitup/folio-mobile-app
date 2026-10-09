import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import i18n from "@/i18n";
import ProjectChiffrageSection from "../../app/(app)/(tabs)/projects/[id]/chiffrage";
import {
  answerGet,
  ok,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";
import type { Persona } from "./helpers/release-qa-fixtures";

/**
 * A retained price could not be un-retained: tapping the selected radio only
 * selected it again, so the only way back to the automatic cheapest price was
 * deleting the price. Tapping it now calls DELETE …/select.
 */
const mockCurrent: Persona = persona("manager");

function quote(id: string, store: string, price: number, isSelected: boolean) {
  return {
    id,
    article_id: "art-1",
    store_id: null,
    supplier_id: null,
    supplier_name: store,
    library_product_id: null,
    unit_price_ht: price,
    tva_rate: 20,
    unit_price_ttc: price * 1.2,
    product_url: null,
    note: null,
    is_selected: isSelected,
  };
}

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
          quantity: 12,
          unit: "m2",
          room_id: null,
          note: null,
          position: 0,
          quotes: [
            quote("quote-cheap", "Brico Dépôt", 25, false),
            quote("quote-kept", "Leroy Merlin", 30, true),
          ],
          image: null,
          effective_source: "selected",
          total_ht: 360,
          total_ttc: 432,
        },
      ],
      store_baskets: [],
      room_subtotals: [],
      subtotal_ht: 360,
      subtotal_ttc: 432,
    },
  ],
  rooms: [],
  stores: [],
  store_baskets: [],
  total_ht: 360,
  total_ttc: 432,
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
const mockDelete = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: (...args: unknown[]) => mockPost(...args),
    PUT: jest.fn(),
    PATCH: jest.fn(),
    DELETE: (...args: unknown[]) => mockDelete(...args),
  },
}));

const CHIFFRAGE_PATH = "/api/v1/projects/{project_id}/chiffrage";
const SELECT_PATH = `${CHIFFRAGE_PATH}/quotes/{quote_id}/select`;

beforeEach(() => {
  jest.clearAllMocks();
  mockPost.mockResolvedValue(ok({}));
  mockDelete.mockResolvedValue(ok({}));
  mockGet.mockImplementation(async (path: string, options?: unknown) => {
    if (path === CHIFFRAGE_PATH) return ok(TREE);
    if (path === `${CHIFFRAGE_PATH}/units`) return ok([]);
    if (path.startsWith("/api/v1/bibliotheque")) return ok({ items: [] });
    return answerGet(() => mockCurrent)(path, options as never);
  });
});

async function openArticle() {
  await renderWithProviders(<ProjectChiffrageSection />);
  await fireEvent.press(await screen.findByText("Carreaux 60x60"));
}

describe("chiffrage retained price", () => {
  it("un-retains the retained price when it is tapped again", async () => {
    await openArticle();
    const kept = screen.getByTestId("quote-select-quote-kept");
    expect(kept.props.accessibilityLabel).toBe(i18n.t("chiffrage.unretain"));
    expect(kept.props.accessibilityState).toMatchObject({ checked: true });

    await fireEvent.press(kept);

    await waitFor(() => expect(mockDelete).toHaveBeenCalled());
    expect(mockDelete.mock.calls[0][0]).toBe(SELECT_PATH);
    expect(mockDelete.mock.calls[0][1]).toMatchObject({
      params: { path: { project_id: "p1", quote_id: "quote-kept" } },
    });
    expect(mockPost).not.toHaveBeenCalledWith(SELECT_PATH, expect.anything());
  });

  it("retains another price with a tap, as before", async () => {
    await openArticle();
    const cheap = screen.getByTestId("quote-select-quote-cheap");
    expect(cheap.props.accessibilityLabel).toBe(i18n.t("chiffrage.retain"));

    await fireEvent.press(cheap);

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(SELECT_PATH, expect.anything()),
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
