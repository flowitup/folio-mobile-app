import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import i18n from "@/i18n";
import ProjectChiffrageSection from "../../app/(app)/(tabs)/projects/[id]/chiffrage";
import { showToast } from "@/components/ui/toast";
import {
  answerGet,
  ok,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";
import type { Persona } from "./helpers/release-qa-fixtures";

/**
 * A cleared (or garbled) quantity or TVA field is refused with a toast instead of being saved
 * as a silent 1 or 20 %, which changed the estimate's totals without a word.
 */
const mockCurrent: Persona = persona("manager");

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
            {
              id: "quote-1",
              article_id: "art-1",
              store_id: null,
              supplier_id: null,
              supplier_name: "Leroy Merlin",
              library_product_id: null,
              unit_price_ht: 30,
              tva_rate: 10,
              unit_price_ttc: 33,
              product_url: null,
              note: null,
              is_selected: true,
            },
          ],
          image: null,
          effective_source: "selected",
          total_ht: 360,
          total_ttc: 396,
        },
      ],
      store_baskets: [],
      room_subtotals: [],
      subtotal_ht: 360,
      subtotal_ttc: 396,
    },
  ],
  rooms: [],
  stores: [],
  store_baskets: [],
  total_ht: 360,
  total_ttc: 396,
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

// The screen toasts outside any rendered tree: spy on the call instead of looking for the bubble.
jest.mock("@/components/ui/toast", () => ({
  ...jest.requireActual("@/components/ui/toast"),
  showToast: jest.fn(),
}));

const mockGet = jest.fn();
const mockPatch = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: jest.fn(),
    PUT: jest.fn(),
    PATCH: (...args: unknown[]) => mockPatch(...args),
    DELETE: jest.fn(),
  },
}));

const CHIFFRAGE_PATH = "/api/v1/projects/{project_id}/chiffrage";

beforeEach(() => {
  jest.clearAllMocks();
  mockPatch.mockResolvedValue(ok({}));
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

describe("chiffrage quantity and TVA fields", () => {
  it.each(["", "abc"])(
    "refuses to save an article quantity of %j",
    async (typed) => {
      await openArticle();
      await fireEvent.press(screen.getByText(i18n.t("common.edit")));
      await fireEvent.changeText(screen.getByTestId("article-quantity"), typed);
      await fireEvent.press(screen.getByTestId("chiffrage-submit"));

      expect(showToast).toHaveBeenCalledWith(
        i18n.t("chiffrage.quantityInvalid"),
        "error",
      );
      expect(mockPatch).not.toHaveBeenCalled();
    },
  );

  it("saves a typed decimal quantity as is", async () => {
    await openArticle();
    await fireEvent.press(screen.getByText(i18n.t("common.edit")));
    await fireEvent.changeText(screen.getByTestId("article-quantity"), "12,5");
    await fireEvent.press(screen.getByTestId("chiffrage-submit"));

    await waitFor(() => expect(mockPatch).toHaveBeenCalled());
    expect(mockPatch.mock.calls[0][1].body).toMatchObject({ quantity: 12.5 });
  });

  it.each(["", "150"])("refuses to save a TVA of %j", async (typed) => {
    await openArticle();
    await fireEvent.press(screen.getByText(/Leroy Merlin/));
    await fireEvent.changeText(screen.getByTestId("quote-tva"), typed);
    await fireEvent.press(screen.getByTestId("chiffrage-submit"));

    expect(showToast).toHaveBeenCalledWith(
      i18n.t("chiffrage.tvaInvalid"),
      "error",
    );
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it("keeps the quote's own TVA when the field is left alone", async () => {
    await openArticle();
    await fireEvent.press(screen.getByText(/Leroy Merlin/));
    await fireEvent.press(screen.getByTestId("chiffrage-submit"));

    await waitFor(() => expect(mockPatch).toHaveBeenCalled());
    expect(mockPatch.mock.calls[0][1].body).toMatchObject({
      tva_rate: 10,
      unit_price_ht: 30,
    });
  });
});
