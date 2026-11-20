/**
 * The overdue-factures reminder opens the billing hub with `?kind=facture`: the list starts on
 * the invoices segment, and the param is dropped once applied so a manual switch sticks.
 */

import { waitFor } from "@testing-library/react-native";

import BillingHub from "../../app/(app)/(tabs)/billing/index";
import {
  BILLING_DEVIS,
  answerGet,
  ok,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";

const mockCurrent = persona("admin");
const mockParams: { kind?: string } = {};
const mockSetParams = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    setParams: mockSetParams,
  }),
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: mockCurrent.user }),
}));
const mockGet = jest.fn();
jest.mock("@/api/client", () => ({
  api: { GET: (...args: unknown[]) => mockGet(...args) },
}));

function answer() {
  return async (path: string, options?: unknown) => {
    if (path === "/api/v1/companies")
      return ok({
        items: [
          {
            company: { id: "e", legal_name: "Epsilon" },
            access: {
              role: "admin",
              is_primary: true,
              attached_at: "2026-09-01T08:00:00Z",
            },
          },
        ],
      });
    if (path === "/api/v1/billing-documents")
      return ok({ items: [{ ...BILLING_DEVIS, id: "d1" }], total: 1 });
    return answerGet(() => mockCurrent)(path, options as never);
  };
}

function requestedKinds(): string[] {
  return mockGet.mock.calls
    .filter(([path]) => path === "/api/v1/billing-documents")
    .map(
      ([, options]) =>
        (options as { params: { query: { kind: string } } }).params.query.kind,
    );
}

beforeEach(() => {
  mockGet.mockReset();
  mockSetParams.mockReset();
  delete mockParams.kind;
});

describe("Billing hub — kind from the route", () => {
  it("opens on the invoices for ?kind=facture and drops the param", async () => {
    mockParams.kind = "facture";
    mockGet.mockImplementation(answer());
    await renderWithProviders(<BillingHub />);
    await waitFor(() => expect(requestedKinds()).toContain("facture"));
    expect(requestedKinds()).not.toContain("devis");
    expect(mockSetParams).toHaveBeenCalledWith({ kind: undefined });
  });

  it("opens on the quotes without a param", async () => {
    mockGet.mockImplementation(answer());
    await renderWithProviders(<BillingHub />);
    await waitFor(() => expect(requestedKinds()).toContain("devis"));
    expect(mockSetParams).not.toHaveBeenCalled();
  });
});
