import { screen, waitFor } from "@testing-library/react-native";

import i18n from "@/i18n";
import BillingHub from "../../app/(app)/(tabs)/billing/index";
import {
  COMPANY_ID,
  answerGet,
  callsTo,
  ok,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";
import type { Persona, Role } from "./helpers/release-qa-fixtures";

/**
 * Billing hub per company role. Quotes and invoices belong to the company, not to a project:
 * the gate is the caller's company role (`admin`, or platform ops), never the project matrix —
 * so a manager of every project still gets the denial. The document list is a company-wide
 * query, and only an allowed caller should ever issue it.
 */
let mockCurrent: Persona = persona("admin");

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
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

/** `GET /companies` with the persona's role — what `useBillingAccess` reads. */
function answerWithCompanyRole() {
  return async (path: string, options?: unknown) => {
    if (path === "/api/v1/companies")
      return ok({
        items: [
          {
            company: { id: COMPANY_ID, legal_name: "Folio QA" },
            access: {
              role: mockCurrent.role,
              is_primary: true,
              attached_at: "2026-09-01T08:00:00Z",
            },
          },
        ],
      });
    return answerGet(() => mockCurrent)(path, options as never);
  };
}

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockImplementation(answerWithCompanyRole());
});

describe("Billing hub per company role", () => {
  it("opens the hub for a company admin", async () => {
    mockCurrent = persona("admin");
    await renderWithProviders(<BillingHub />);

    await waitFor(() =>
      expect(screen.getByTestId("billing-kind")).toBeTruthy(),
    );
    expect(screen.getByTestId("billing-search")).toBeTruthy();
    expect(screen.queryByText(i18n.t("billing.accessDenied"))).toBeNull();
    await waitFor(() =>
      expect(callsTo(mockGet, DOCUMENTS_PATH).length).toBeGreaterThan(0),
    );
  });

  it.each(["manager", "member"] as Role[])(
    "denies a company %s and never asks for the documents",
    async (role) => {
      mockCurrent = persona(role);
      await renderWithProviders(<BillingHub />);

      await waitFor(() =>
        expect(screen.getByText(i18n.t("billing.accessDenied"))).toBeTruthy(),
      );
      expect(screen.queryByTestId("billing-kind")).toBeNull();
      expect(screen.queryByTestId("billing-search")).toBeNull();
      expect(callsTo(mockGet, DOCUMENTS_PATH)).toHaveLength(0);
    },
  );
});
