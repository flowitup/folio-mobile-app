import { fireEvent, screen } from "@testing-library/react-native";

import i18n from "@/i18n";
import BillingDocumentScreen from "../../app/(app)/(tabs)/billing/documents/[docId]";
import type { BillingDocument } from "@/features/billing/billing-types";
import { renderWithProviders } from "./helpers/release-qa-fixtures";

let mockDoc: Partial<BillingDocument> = {};
const mockSetStatus = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ docId: "doc-1" }),
  useFocusEffect: () => undefined,
}));

jest.mock("@/features/billing/billing-document-form", () => ({
  ...jest.requireActual("@/features/billing/billing-document-form"),
  BillingDocumentForm: () => null,
}));

jest.mock("@/features/billing/billing-documents-api", () => {
  const mutation = () => ({ mutate: jest.fn(), isPending: false });
  return {
    openBillingFile: jest.fn(),
    useBillingDocument: () => ({
      data: mockDoc,
      isPending: false,
      refetch: jest.fn(),
    }),
    useCloneBillingDocument: mutation,
    useConvertDevisToFacture: mutation,
    useDeleteBillingDocument: mutation,
    useSetBillingStatus: () => ({ mutate: mockSetStatus, isPending: false }),
    useUpdateBillingDocument: mutation,
  };
});

function doc(overrides: Partial<BillingDocument>): Partial<BillingDocument> {
  return {
    id: "doc-1",
    kind: "facture",
    document_number: "FAC-2026-024",
    status: "paid",
    issue_date: "2026-09-27",
    recipient_name: "Client",
    items: [],
    total_ht: "50.00",
    total_tva: "10.00",
    total_ttc: "60.00",
    updated_at: "2026-09-27T10:00:00Z",
    ...overrides,
  };
}

describe("billing document cancel", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });
  beforeEach(() => mockSetStatus.mockClear());

  it("asks before cancelling a paid facture, and warns about its funds release", async () => {
    mockDoc = doc({ status: "paid" });
    await renderWithProviders(<BillingDocumentScreen />);
    await fireEvent.press(screen.getByTestId("status-cancelled"));

    expect(mockSetStatus).not.toHaveBeenCalled();
    expect(
      screen.getByText(i18n.t("billing.actions.cancelPaidWarning")),
    ).toBeTruthy();
  });

  it("applies a non-terminal move at once", async () => {
    mockDoc = doc({ status: "sent" });
    await renderWithProviders(<BillingDocumentScreen />);
    await fireEvent.press(screen.getByTestId("status-paid"));

    expect(mockSetStatus).toHaveBeenCalledWith(
      { id: "doc-1", new_status: "paid" },
      expect.anything(),
    );
  });
});
