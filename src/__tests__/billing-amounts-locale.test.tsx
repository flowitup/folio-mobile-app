import { screen } from "@testing-library/react-native";

import i18n from "@/i18n";
import BillingDocumentScreen from "../../app/(app)/(tabs)/billing/documents/[docId]";
import {
  BillingDocumentForm,
  draftFromSeed,
} from "@/features/billing/billing-document-form";
import type { BillingDocument } from "@/features/billing/billing-types";
import { formatMoney } from "@/lib/format/money";
import { renderWithProviders } from "./helpers/release-qa-fixtures";

/**
 * Billing amounts speak the reader's language: the document header and totals said
 * "HT / TVA / TTC" in Vietnamese, and VAT rates kept a dot decimal in French ("TVA 5.5 %").
 */
const DOC: Partial<BillingDocument> = {
  id: "doc-1",
  kind: "devis",
  document_number: "DEV-2026-001",
  status: "draft",
  issue_date: "2026-10-09",
  recipient_name: "Client",
  issuer_legal_name: "Folio Demo SARL",
  items: [
    {
      description: "Peinture",
      quantity: "2",
      unit_price: "100",
      vat_rate: "5.5",
    },
  ],
  total_ht: "200.00",
  total_tva: "11.00",
  total_ttc: "211.00",
  converted_to_facture_id: null,
  updated_at: "2026-10-09T10:00:00Z",
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ docId: "doc-1" }),
  useFocusEffect: () => undefined,
}));

jest.mock("@/features/projects/projects-api", () => ({
  ...jest.requireActual("@/features/projects/projects-api"),
  useProjects: () => ({ data: [], isPending: false }),
}));

jest.mock("@/features/billing/billing-documents-api", () => {
  const mutation = () => ({ mutate: jest.fn(), isPending: false });
  return {
    openBillingFile: jest.fn(),
    useActivitySuggestions: () => ({ data: undefined, isPending: false }),
    useBillingDocument: () => ({
      data: DOC,
      isPending: false,
      refetch: jest.fn(),
    }),
    useCloneBillingDocument: mutation,
    useConvertDevisToFacture: mutation,
    useDeleteBillingDocument: mutation,
    useSetBillingStatus: mutation,
    useUpdateBillingDocument: mutation,
  };
});

afterAll(async () => {
  await i18n.changeLanguage("en");
});

describe("billing amounts · Vietnamese", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("vi");
  });

  it("labels the header and the totals in Vietnamese, without HT / TVA / TTC", async () => {
    await renderWithProviders(<BillingDocumentScreen />);

    expect(screen.getByTestId("doc-totals")).toHaveTextContent(
      `${formatMoney("200.00")} chưa VAT · ${formatMoney("11.00")} VAT · ${formatMoney("211.00")} gồm VAT`,
    );
    expect(screen.getByText("Tổng (chưa VAT)")).toBeTruthy();
    expect(screen.getByText("Tổng (gồm VAT)")).toBeTruthy();
    expect(screen.queryByText(/\b(HT|TVA|TTC)\b/)).toBeNull();
  });
});

describe("billing amounts · French", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("writes VAT rates with a decimal comma", async () => {
    await renderWithProviders(
      <BillingDocumentForm
        kind="devis"
        mode="edit"
        initial={draftFromSeed("devis", DOC)}
        submitting={false}
        submitLabel="Enregistrer"
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByText("TVA 5,5 %")).toBeTruthy();
    // The 5.5 preset chip of the line.
    expect(screen.getByText("5,5 %")).toBeTruthy();
    expect(screen.queryByText(/5\.5/)).toBeNull();
  });
});
