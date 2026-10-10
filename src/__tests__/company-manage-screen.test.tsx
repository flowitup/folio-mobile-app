/**
 * The company manage screen (Settings > My companies > Manage) is open to company admins, but
 * `DELETE /companies/<id>` is platform-ops only: every admin saw a Delete tab whose confirm
 * always ended in a 403. Its Users tab also printed a phone sign-up's synthetic
 * `phone-…@no-email…` address as the member's contact.
 */

import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import "@/i18n";
import CompanyManageScreen from "../../app/(app)/(tabs)/settings/companies/[companyId]";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const COMPANY = {
  id: "c1",
  legal_name: "QA Co",
  address: "1 rue de la Paix, Paris",
  siret: null,
  tva_number: null,
  iban: null,
  bic: null,
  prefix_override: null,
  default_payment_terms: null,
  join_code: null,
  updated_at: "2026-10-01T00:00:00Z",
};

const PHONE_MEMBER = {
  user_id: "u2",
  email: "phone-33621400002@no-email.folio.flowitup.com",
  display_name: "QA Joiner",
  phone: "+33621400002",
  is_primary: false,
  attached_at: "2026-10-01T00:00:00Z",
  role: "member",
};

let mockUser: object = { id: "u1", is_platform_ops: false, permissions: [] };

const idle = () => ({ mutate: jest.fn(), isPending: false });
jest.mock("@/features/companies/companies-api", () => ({
  useCompany: () => ({ data: COMPANY, isPending: false, refetch: jest.fn() }),
  useUpdateCompany: () => idle(),
  useSetJoinCode: () => idle(),
  useRevokeJoinCode: () => idle(),
  useDeleteCompany: () => idle(),
  useSetMemberRole: () => idle(),
  useBootAttachedUser: () => idle(),
}));
jest.mock("@/features/companies/company-members-api", () => ({
  useAttachedUsers: () => ({ data: [PHONE_MEMBER], isPending: false }),
}));
jest.mock("@/features/companies/company-form-sheet", () => ({
  CompanyFormSheet: () => null,
}));
jest.mock("@/features/companies/payment-methods-section", () => ({
  PaymentMethodsSection: () => null,
}));
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ companyId: "c1" }),
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

async function renderScreen() {
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <CompanyManageScreen />
    </SafeAreaProvider>,
  );
}

describe("company manage screen", () => {
  it("offers no Delete tab to a company admin, whose delete the API refuses", async () => {
    mockUser = { id: "u1", is_platform_ops: false, permissions: [] };
    await renderScreen();

    expect(screen.getByTestId("company-tab-users")).toBeTruthy();
    expect(screen.queryByTestId("company-tab-delete")).toBeNull();
  });

  it("offers the Delete tab to platform ops", async () => {
    mockUser = { id: "u1", is_platform_ops: true, permissions: [] };
    await renderScreen();

    await fireEvent.press(screen.getByTestId("company-tab-delete"));
    expect(screen.getByTestId("company-delete")).toBeTruthy();
  });

  it("shows a phone sign-up's number on the Users tab, not its synthetic address", async () => {
    mockUser = { id: "u1", is_platform_ops: false, permissions: [] };
    await renderScreen();

    await fireEvent.press(screen.getByTestId("company-tab-users"));
    expect(screen.getByText(/\+33621400002/)).toBeTruthy();
    expect(screen.queryByText(/no-email\.folio\.flowitup\.com/)).toBeNull();
  });
});
