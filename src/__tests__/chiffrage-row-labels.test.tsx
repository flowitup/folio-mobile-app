import { fireEvent, screen } from "@testing-library/react-native";

import i18n, { DEFAULT_LOCALE } from "@/i18n";
import { LibraryProductPickerSheet } from "@/features/chiffrage/library-product-picker-sheet";
import ProjectChiffrageSection from "../../app/(app)/(tabs)/projects/[id]/chiffrage";
import {
  answerGet,
  ok,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";
import type { Persona } from "./helpers/release-qa-fixtures";

/**
 * Article and price rows appended a French " HT" / " TTC" in every language and
 * printed the raw quantity ("2.5" in French). The labels now come from the
 * locale and the quantity uses the locale's decimal mark.
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
          quantity: 2.5,
          unit: "m2",
          room_id: null,
          note: null,
          position: 0,
          quotes: [quote("quote-kept", "Leroy Merlin", 30, true)],
          image: null,
          effective_source: "selected",
          total_ht: 75,
          total_ttc: 90,
        },
      ],
      store_baskets: [],
      room_subtotals: [],
      subtotal_ht: 360,
      subtotal_ttc: 432,
    },
  ],
  rooms: [],
  stores: [{ id: "store-1", name: "Leroy Merlin", website_url: null }],
  store_baskets: [
    {
      store_id: "store-1",
      basket_ttc: 90,
      priced_article_count: 1,
      total_article_count: 1,
      covers_all: true,
    },
  ],
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

afterEach(async () => {
  await i18n.changeLanguage(DEFAULT_LOCALE);
});

async function openArticle(locale: string) {
  await i18n.changeLanguage(locale);
  await renderWithProviders(<ProjectChiffrageSection />);
  await fireEvent.press(await screen.findByText("Carreaux 60x60"));
}

describe("chiffrage row labels", () => {
  it("translates HT / TTC in English", async () => {
    await openArticle("en");
    expect(screen.getByText(/2\.5 m2/)).toBeTruthy();
    expect(screen.getByText(/€90\.00 incl\. VAT \(/)).toBeTruthy();
    expect(
      screen.getByText(/€30\.00 excl\. VAT · €36\.00 incl\. VAT/),
    ).toBeTruthy();
    expect(screen.getByText(/Leroy Merlin: €90\.00 incl\. VAT ·/)).toBeTruthy();
    expect(screen.queryByText(/\bTTC\b|\bHT\b/)).toBeNull();
  });

  it("keeps HT / TTC in French and shows the quantity as 2,5", async () => {
    await openArticle("fr");
    expect(screen.getByText(/2,5 m2/)).toBeTruthy();
    expect(screen.getByText(/30,00\s€ HT · 36,00\s€ TTC/)).toBeTruthy();
  });

  it("uses the Vietnamese labels", async () => {
    await openArticle("vi");
    expect(screen.getByText(/2,5 m2/)).toBeTruthy();
    expect(screen.getByText(/chưa VAT · .* có VAT/)).toBeTruthy();
  });

  it("labels the library picker's last price with the locale's HT", async () => {
    mockGet.mockImplementation(async (path: string) => {
      if (path === "/api/v1/bibliotheque/suppliers")
        return ok({ items: [{ id: "sup-1", name: "Point P" }] });
      if (path === "/api/v1/bibliotheque/products")
        return ok({
          items: [
            {
              id: "prod-1",
              name: "Ciment 35kg",
              supplier_id: "sup-1",
              supplier_reference: "CIM35",
              last_unit_price: "9.5",
              product_url: null,
            },
          ],
          total: 1,
          page: 1,
          page_size: 20,
        });
      return ok({ items: [] });
    });
    await i18n.changeLanguage("en");
    await renderWithProviders(
      <LibraryProductPickerSheet companyId="c1" onPick={jest.fn()} />,
    );
    expect(await screen.findByText(/CIM35 · €9\.50 excl\. VAT/)).toBeTruthy();
    expect(screen.queryByText(/\bHT\b/)).toBeNull();
  });
});
