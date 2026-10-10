import { screen, within } from "@testing-library/react-native";

import LibraryScreen from "../../app/(app)/(tabs)/library/index";
import { ok, renderWithProviders } from "./helpers/release-qa-fixtures";

/**
 * At phone width the search shared its row with "Compare" and "Import purchases", which are
 * long in French, and its placeholder was cut to "Rechercher un". It now has a row of its own.
 */
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => undefined,
}));
// Manage rights come from the company on screen (GET /companies `permissions`).
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: { id: "u1", permissions: [] } }),
}));

const mockGet = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: jest.fn(),
    PUT: jest.fn(),
    PATCH: jest.fn(),
    DELETE: jest.fn(),
  },
}));

beforeEach(() => {
  mockGet.mockImplementation(async (path: string) =>
    path === "/api/v1/companies"
      ? ok({
          items: [
            {
              company: { id: "c1", legal_name: "Folio QA" },
              access: { is_primary: true, attached_at: "x", role: "admin" },
              permissions: ["bibliotheque:manage"],
            },
          ],
        })
      : ok({ items: [], total: 0 }),
  );
});

describe("library search", () => {
  it("does not share its row with the Compare and Import buttons", async () => {
    await renderWithProviders(<LibraryScreen />);
    expect(await screen.findByTestId("library-search")).toBeTruthy();
    // The row that holds the Compare button no longer holds the search field.
    let row = screen.getByTestId("library-compare-toggle").parent;
    while (row && row.type !== "View") row = row.parent;
    expect(row).toBeTruthy();
    expect(within(row!).queryByTestId("library-search")).toBeNull();
    expect(within(row!).getByTestId("library-import")).toBeTruthy();
  });
});
