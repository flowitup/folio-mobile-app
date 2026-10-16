import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";

import BillingHub from "../../app/(app)/(tabs)/billing/index";
import {
  BILLING_DEVIS,
  COMPANY_ID,
  answerGet,
  callsTo,
  ok,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";
import type { Persona } from "./helpers/release-qa-fixtures";

/**
 * The hub sends the search to the API (`q`, after a typing pause), so a document on a page
 * that was never loaded is found without downloading every page first.
 */

let mockCurrent: Persona = persona("admin");

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useFocusEffect: () => undefined,
}));

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: mockCurrent.user }),
}));

const mockGet = jest.fn();
jest.mock("@/api/client", () => ({
  api: { GET: (...args: unknown[]) => mockGet(...args) },
}));

const DOCUMENTS_PATH = "/api/v1/billing-documents";
const PAGE_ONE = Array.from({ length: 25 }, (_, i) => ({
  ...BILLING_DEVIS,
  id: `p1-${i}`,
  document_number: `DEV-2026-${String(i + 1).padStart(4, "0")}`,
}));
const PAGE_TWO_DOC = {
  ...BILLING_DEVIS,
  id: "p2-0",
  document_number: "DEV-2026-9999",
  recipient_name: "Zulu Client",
};

function answer() {
  return async (path: string, options?: unknown) => {
    if (path === "/api/v1/companies")
      return ok({
        items: [
          {
            company: { id: COMPANY_ID, legal_name: "Folio QA" },
            access: {
              role: "admin",
              is_primary: true,
              attached_at: "2026-09-01T08:00:00Z",
            },
          },
        ],
      });
    if (path === DOCUMENTS_PATH) {
      const query = (options as { params: { query: { q?: string } } }).params
        .query;
      if (query.q === "zulu") return ok({ items: [PAGE_TWO_DOC], total: 1 });
      return ok({ items: PAGE_ONE, total: 26 });
    }
    return answerGet(() => mockCurrent)(path, options as never);
  };
}

function documentQueries() {
  return callsTo(mockGet, DOCUMENTS_PATH).map(
    (call) =>
      (call[1] as { params: { query: Record<string, unknown> } }).params.query,
  );
}

beforeEach(() => {
  mockCurrent = persona("admin");
  mockGet.mockReset();
});

describe("Billing hub search", () => {
  it("asks the API once after a typing pause and shows a match from an unloaded page", async () => {
    mockGet.mockImplementation(answer());
    await renderWithProviders(<BillingHub />);
    await waitFor(() =>
      expect(screen.getByTestId(`billing-doc-${PAGE_ONE[0].id}`)).toBeTruthy(),
    );
    expect(screen.queryByTestId(`billing-doc-${PAGE_TWO_DOC.id}`)).toBeNull();

    await act(async () => {
      fireEvent.changeText(screen.getByTestId("billing-search"), "z");
      fireEvent.changeText(screen.getByTestId("billing-search"), "zu");
      fireEvent.changeText(screen.getByTestId("billing-search"), "zulu");
    });

    await waitFor(() =>
      expect(screen.getByTestId(`billing-doc-${PAGE_TWO_DOC.id}`)).toBeTruthy(),
    );
    const queries = documentQueries();
    expect(queries).toHaveLength(2);
    expect(queries[0].q).toBeUndefined();
    expect(queries[1]).toMatchObject({ q: "zulu", offset: 0 });
    // Never pulls page two of the unfiltered list.
    expect(queries.some((q) => q.offset !== 0)).toBe(false);
    expect(screen.queryByTestId(`billing-doc-${PAGE_ONE[0].id}`)).toBeNull();
  });
});
