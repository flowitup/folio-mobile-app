import { screen } from "@testing-library/react-native";

import {
  BillingDocumentForm,
  draftFromSeed,
} from "@/features/billing/billing-document-form";
import { renderWithProviders } from "./helpers/release-qa-fixtures";

/**
 * mobile-projects-money-08: a new facture showed empty payment terms while its PDF printed
 * the company's default ones; the form now starts from them.
 */
jest.mock("@/features/companies/companies-api", () => ({
  ...jest.requireActual("@/features/companies/companies-api"),
  useCompany: (id: string | undefined) => ({
    data: id
      ? { id, default_payment_terms: "Paiement à 30 jours fin de mois" }
      : undefined,
  }),
}));

jest.mock("@/features/projects/projects-api", () => ({
  ...jest.requireActual("@/features/projects/projects-api"),
  useProjects: () => ({ data: [], isPending: false }),
}));

jest.mock("@/features/billing/company-picker", () => ({
  CompanyPicker: () => null,
}));

function form(kind: "facture" | "devis") {
  return (
    <BillingDocumentForm
      kind={kind}
      mode="create"
      initial={{ ...draftFromSeed(kind, null), company_id: "c1" }}
      submitting={false}
      submitLabel="Create"
      onSubmit={jest.fn()}
    />
  );
}

it("prefills a new facture's payment terms from the company default", async () => {
  await renderWithProviders(form("facture"));
  expect(
    screen.getByDisplayValue("Paiement à 30 jours fin de mois"),
  ).toBeTruthy();
});
