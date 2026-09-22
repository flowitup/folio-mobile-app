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
 * The billing API has no search parameter, so the hub filters the pages it has downloaded
 * and keeps pulling the next page while a needle is set. Two invariants: a document that
 * lives on page two is found, and a page that fails to load stops the loop instead of
 * retrying forever — the manual "load more" button then takes over.
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

function answer(pageTwo: () => unknown) {
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
      const offset = (options as { params: { query: { offset: number } } })
        .params.query.offset;
      if (offset === 0) return ok({ items: PAGE_ONE, total: 26 });
      return pageTwo();
    }
    return answerGet(() => mockCurrent)(path, options as never);
  };
}

beforeEach(() => {
  mockCurrent = persona("admin");
  mockGet.mockReset();
});

describe("Billing hub search across pages", () => {
  it("keeps paging while a needle is set until the match on page two shows", async () => {
    mockGet.mockImplementation(
      answer(() => ok({ items: [PAGE_TWO_DOC], total: 26 })),
    );
    await renderWithProviders(<BillingHub />);
    await waitFor(() =>
      expect(screen.getByTestId(`billing-doc-${PAGE_ONE[0].id}`)).toBeTruthy(),
    );
    expect(screen.queryByTestId(`billing-doc-${PAGE_TWO_DOC.id}`)).toBeNull();

    await act(async () => {
      fireEvent.changeText(screen.getByTestId("billing-search"), "zulu");
    });

    await waitFor(() =>
      expect(screen.getByTestId(`billing-doc-${PAGE_TWO_DOC.id}`)).toBeTruthy(),
    );
    expect(callsTo(mockGet, DOCUMENTS_PATH)).toHaveLength(2);
  });

  it("stops after a failed page and hands over to the manual button", async () => {
    mockGet.mockImplementation(
      answer(() => ({
        data: undefined,
        error: { message: "boom" },
        response: { status: 500, statusText: "Server Error" },
      })),
    );
    await renderWithProviders(<BillingHub />);
    await waitFor(() =>
      expect(screen.getByTestId(`billing-doc-${PAGE_ONE[0].id}`)).toBeTruthy(),
    );

    await act(async () => {
      fireEvent.changeText(screen.getByTestId("billing-search"), "zulu");
    });

    await waitFor(() =>
      expect(screen.getByTestId("billing-load-more")).toBeTruthy(),
    );
    // Let any further effect ticks run: a looping effect would keep adding calls.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(callsTo(mockGet, DOCUMENTS_PATH)).toHaveLength(2);
  });
});
