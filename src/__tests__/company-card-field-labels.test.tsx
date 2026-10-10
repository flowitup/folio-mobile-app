/**
 * The company card wrote "SIRET … · TVA … · IBAN … · BIC …" as literal text in every language,
 * so a Vietnamese reader saw French acronyms that match none of the labels the company form
 * (and the web card) uses for the same fields.
 */

import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import i18n from "@/i18n";
import MyCompaniesScreen from "../../app/(app)/(tabs)/settings/companies/index";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const COMPANY = {
  id: "c1",
  legal_name: "Folio Demo SARL",
  address: "1 rue de la Paix, Paris",
  siret: "123 456 789 00010",
  tva_number: "FR12345678901",
  iban: "FR76 •••• 0189",
  bic: "BNPAFRPP",
  role: "admin",
  is_primary: true,
};

const idle = () => ({ mutate: jest.fn(), isPending: false });
jest.mock("@/features/companies/companies-api", () => ({
  useMyCompanies: () => ({
    data: [COMPANY],
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useSetPrimaryCompany: () => idle(),
  useDetachCompany: () => idle(),
  useCreateCompany: () => idle(),
}));
jest.mock("@/features/companies/company-form-sheet", () => ({
  CompanyFormSheet: () => null,
}));
jest.mock("@/lib/query/use-refetch-on-focus", () => ({
  useRefetchOnFocus: () => undefined,
}));
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: { id: "u1", is_platform_ops: false } }),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));

afterAll(async () => {
  await i18n.changeLanguage("vi");
});

async function renderScreen() {
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <MyCompaniesScreen />
    </SafeAreaProvider>,
  );
}

describe("my companies card", () => {
  it("labels the legal fields with the form's translated labels", async () => {
    await i18n.changeLanguage("vi");
    await renderScreen();

    const line = screen.getByText(/FR12345678901/);
    expect(line).toHaveTextContent(
      `${i18n.t("companies.form.fields.siret.label")}: ${COMPANY.siret}`,
      { exact: false },
    );
    expect(line).toHaveTextContent(
      `${i18n.t("companies.form.fields.tvaNumber.label")}: ${COMPANY.tva_number}`,
      { exact: false },
    );
    expect(line).toHaveTextContent(
      `${i18n.t("companies.form.fields.bic.label")}: ${COMPANY.bic}`,
      { exact: false },
    );
    expect(line).not.toHaveTextContent(/SIRET|TVA /);
  });
});
