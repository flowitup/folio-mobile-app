import { screen, waitFor } from "@testing-library/react-native";

import i18n from "@/i18n";
import RefundableExpensesScreen from "../../app/(app)/(tabs)/billing/refundable";
import { CompanyPicker } from "@/features/billing/company-picker";
import {
  ok,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";

/**
 * Billing is admin-only per company: the API answers 403 for a company where the caller is a
 * member. The issuer picker and the refundable list's company filter offer only the companies
 * the caller administers, and a remembered pick outside them is ignored.
 */
let mockCurrent = persona("admin");

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => undefined,
}));

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: mockCurrent.user }),
}));

let mockStored: string | null = null;
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => mockStored),
  setItemAsync: jest.fn(async () => undefined),
}));

type Row = { id: string; name: string; role: string; primary?: boolean };
let mockCompanies: Row[] = [];
const mockGet = jest.fn(async (path: string) => {
  if (path === "/api/v1/companies")
    return ok({
      items: mockCompanies.map((row) => ({
        company: { id: row.id, legal_name: row.name },
        access: {
          role: row.role,
          is_primary: Boolean(row.primary),
          attached_at: "2026-09-01T08:00:00Z",
        },
      })),
    });
  if (path === "/api/v1/billing/materials-expenses")
    return ok({ items: [], total: 0, summary: null });
  return ok({});
});
jest.mock("@/api/client", () => ({
  api: { GET: (path: string) => mockGet(path) },
}));

const X_ONE = { id: "c-one", name: "Xco One", role: "admin" };
const X_TWO = { id: "c-two", name: "Xco Two", role: "admin" };
const Y_MEMBER = { id: "c-y", name: "Yco", role: "member", primary: true };

beforeEach(() => {
  mockCurrent = persona("admin");
  mockStored = null;
});

describe("CompanyPicker", () => {
  it("offers only the companies the caller administers", async () => {
    mockCompanies = [Y_MEMBER, X_ONE, X_TWO];
    const onChange = jest.fn();
    await renderWithProviders(
      <CompanyPicker kind="devis" value={null} onChange={onChange} />,
    );
    await screen.findByTestId("company-picker");
    expect(screen.getByTestId("company-picker-option-c-one")).toBeTruthy();
    expect(screen.getByTestId("company-picker-option-c-two")).toBeTruthy();
    expect(screen.queryByTestId("company-picker-option-c-y")).toBeNull();
    // The member-only primary is not the default either.
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("c-one"));
    expect(onChange).not.toHaveBeenCalledWith("c-y");
  });

  it("ignores a remembered company the caller no longer administers", async () => {
    mockCompanies = [Y_MEMBER, X_ONE, X_TWO];
    mockStored = "c-y";
    const onChange = jest.fn();
    await renderWithProviders(
      <CompanyPicker kind="facture" value={null} onChange={onChange} />,
    );
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("c-one"));
    expect(onChange).not.toHaveBeenCalledWith("c-y");
  });

  it("replaces a seeded member-only company with an admin one", async () => {
    mockCompanies = [Y_MEMBER, X_ONE, X_TWO];
    mockStored = "c-two";
    const onChange = jest.fn();
    await renderWithProviders(
      <CompanyPicker kind="devis" value="c-y" onChange={onChange} />,
    );
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("c-two"));
  });

  it("shows the single administered company as a label", async () => {
    mockCompanies = [Y_MEMBER, X_ONE];
    const onChange = jest.fn();
    await renderWithProviders(
      <CompanyPicker kind="devis" value={null} onChange={onChange} />,
    );
    expect(
      await screen.findByText(
        i18n.t("billing.form.issuedFrom", { name: "Xco One" }),
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId("company-picker")).toBeNull();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("c-one"));
  });

  it("explains why nothing can be issued without an admin role", async () => {
    mockCompanies = [Y_MEMBER];
    await renderWithProviders(
      <CompanyPicker kind="devis" value={null} onChange={jest.fn()} />,
    );
    expect(await screen.findByTestId("company-picker-empty")).toHaveTextContent(
      i18n.t("billing.form.noAdminCompanies"),
    );
  });
});

describe("Refundable expenses company filter", () => {
  it("lists only administered companies", async () => {
    mockCompanies = [Y_MEMBER, X_ONE, X_TWO];
    await renderWithProviders(<RefundableExpensesScreen />);
    await screen.findByTestId("refundable-company");
    expect(screen.getByTestId("refundable-company-option-c-one")).toBeTruthy();
    expect(screen.getByTestId("refundable-company-option-c-two")).toBeTruthy();
    expect(screen.queryByTestId("refundable-company-option-c-y")).toBeNull();
  });

  it("hides the filter when only one company is administered", async () => {
    mockCompanies = [Y_MEMBER, X_ONE];
    await renderWithProviders(<RefundableExpensesScreen />);
    await waitFor(() =>
      expect(
        mockGet.mock.calls.some(
          ([path]) => path === "/api/v1/billing/materials-expenses",
        ),
      ).toBe(true),
    );
    expect(screen.queryByTestId("refundable-company")).toBeNull();
  });
});
