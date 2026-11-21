import { screen } from "@testing-library/react-native";

import { ChiffrageDashboard } from "@/features/chiffrage/chiffrage-dashboard";
import type {
  ChiffrageArticle,
  ChiffragePoste,
  ChiffrageTree,
} from "@/features/chiffrage/chiffrage-types";

import i18n from "@/i18n";
import { renderWithProviders } from "./helpers/release-qa-fixtures";

/** Budget dashboard: spend vs estimate, per-section bars, attention list. */
const art = (
  id: string,
  over: Partial<ChiffrageArticle> = {},
): ChiffrageArticle =>
  ({
    id,
    poste_id: "p",
    name: `Item ${id}`,
    quantity: 10,
    unit: "u",
    note: null,
    room_id: null,
    position: 0,
    quotes: [],
    image_ref: null,
    effective_quote_id: "q",
    effective_source: "cheapest",
    total_ht: 100,
    total_ttc: 120,
    purchased: false,
    purchased_quantity: null,
    returned_quantity: null,
    actual_ttc: null,
    ...over,
  }) as ChiffrageArticle;

const poste = (
  id: string,
  name: string,
  articles: ChiffrageArticle[],
): ChiffragePoste =>
  ({
    id,
    project_id: "t",
    name,
    note: null,
    position: 0,
    articles,
    store_baskets: [],
    room_subtotals: [],
    subtotal_ht: 0,
    subtotal_ttc: articles.reduce((s, a) => s + a.total_ttc, 0),
    actual_ttc: articles.reduce((s, a) => s + (a.actual_ttc ?? 0), 0),
    purchased_count: articles.filter((a) => a.purchased).length,
  }) as ChiffragePoste;

const tree = (postes: ChiffragePoste[]): ChiffrageTree => ({
  project_id: "t",
  postes,
  rooms: [],
  stores: [],
  store_baskets: [],
  total_ht: 0,
  total_ttc: postes.reduce((s, p) => s + p.subtotal_ttc, 0),
  unpriced_article_count: 0,
  actual_ttc: postes.reduce((s, p) => s + (p.actual_ttc ?? 0), 0),
  purchased_count: postes.reduce((s, p) => s + (p.purchased_count ?? 0), 0),
  article_count: postes.reduce((s, p) => s + p.articles.length, 0),
});

describe("ChiffrageDashboard", () => {
  beforeAll(() => i18n.changeLanguage("en"));

  it("lists unpriced, over-estimate and untouched sections", async () => {
    await renderWithProviders(
      <ChiffrageDashboard
        tree={tree([
          poste("a", "Doublage", [
            art("1", {
              purchased: true,
              purchased_quantity: 10,
              actual_ttc: 130,
            }),
            art("2", { effective_source: "none", effective_quote_id: null }),
          ]),
          poste("b", "Chauffage", [art("3")]),
        ])}
      />,
    );
    expect(screen.getByText("Item 2: no price yet")).toBeTruthy();
    expect(screen.getByText(/Item 1: over estimate by/)).toBeTruthy();
    expect(screen.getByText("Chauffage: nothing bought yet")).toBeTruthy();
  });

  it("shows nothing about spend before a purchase and a clean attention list", async () => {
    await renderWithProviders(
      <ChiffrageDashboard tree={tree([poste("a", "Doublage", [art("1")])])} />,
    );
    expect(screen.queryByTestId("chiffrage-spend")).toBeNull();
    expect(screen.getByText("Nothing needs attention.")).toBeTruthy();
  });
});
