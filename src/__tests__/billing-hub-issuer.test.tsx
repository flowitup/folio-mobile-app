/**
 * Two companies can both have a FAC-2026-001: with several administered companies the billing
 * hub names each document's issuer and can narrow the list to one company (company_id).
 */

import { screen, waitFor } from "@testing-library/react-native";

import BillingHub from "../../app/(app)/(tabs)/billing/index";
import {
  BILLING_DEVIS,
  answerGet,
  ok,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";

const mockCurrent = persona("admin");

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

const company = (id: string, name: string, attached: string) => ({
  company: { id, legal_name: name },
  access: { role: "admin", is_primary: false, attached_at: attached },
});

function answer(companies: unknown[]) {
  return async (path: string, options?: unknown) => {
    if (path === "/api/v1/companies") return ok({ items: companies });
    if (path === "/api/v1/billing-documents")
      return ok({
        items: [
          { ...BILLING_DEVIS, id: "d1", issuer_legal_name: "Epsilon" },
          { ...BILLING_DEVIS, id: "d2", issuer_legal_name: "Zeta" },
        ],
        total: 2,
      });
    return answerGet(() => mockCurrent)(path, options as never);
  };
}

beforeEach(() => mockGet.mockReset());

describe("Billing hub — issuer", () => {
  it("names each document's issuer and offers a company filter with several companies", async () => {
    mockGet.mockImplementation(
      answer([
        company("e", "Epsilon", "2026-09-01T08:00:00Z"),
        company("z", "Zeta", "2026-09-02T08:00:00Z"),
      ]),
    );
    await renderWithProviders(<BillingHub />);
    await waitFor(() => expect(screen.getByTestId("billing-doc-issuer-d1")).toBeTruthy());
    expect(screen.getByTestId("billing-doc-issuer-d1")).toHaveTextContent("Epsilon");
    expect(screen.getByTestId("billing-doc-issuer-d2")).toHaveTextContent("Zeta");
    expect(screen.getByTestId("billing-company")).toBeTruthy();
  });

  it("keeps the single-company list as it was", async () => {
    mockGet.mockImplementation(answer([company("e", "Epsilon", "2026-09-01T08:00:00Z")]));
    await renderWithProviders(<BillingHub />);
    await waitFor(() => expect(screen.getByTestId("billing-doc-d1")).toBeTruthy());
    expect(screen.queryByTestId("billing-doc-issuer-d1")).toBeNull();
    expect(screen.queryByTestId("billing-company")).toBeNull();
  });
});
