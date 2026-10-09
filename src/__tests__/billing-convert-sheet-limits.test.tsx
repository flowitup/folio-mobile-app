import { fireEvent, screen } from "@testing-library/react-native";

import i18n from "@/i18n";
import BillingDocumentScreen from "../../app/(app)/(tabs)/billing/documents/[docId]";
import type { BillingDocument } from "@/features/billing/billing-types";
import { parseIsoDate, toIsoDate } from "@/lib/format/date";
import { renderWithProviders } from "./helpers/release-qa-fixtures";

// The convert sheet must not send what the API refuses: a due date before the
// facture's issue date (today) or payment terms over 500 characters.

const mockPickerProps: Record<string, unknown>[] = [];
jest.mock(
  "@react-native-community/datetimepicker",
  () =>
    function DateTimePicker(props: Record<string, unknown>) {
      mockPickerProps.push(props);
      return null;
    },
);

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ docId: "devis-1" }),
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
      data: {
        id: "devis-1",
        kind: "devis",
        document_number: "DEV-2026-008",
        status: "accepted",
        issue_date: "2026-09-27",
        recipient_name: "Client",
        items: [],
        total_ht: "50.00",
        total_tva: "10.00",
        total_ttc: "60.00",
        updated_at: "2026-09-27T10:00:00Z",
        converted_to_facture_id: null,
      } as Partial<BillingDocument>,
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

describe("convert devis sheet", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("caps payment terms at 500 characters", async () => {
    await renderWithProviders(<BillingDocumentScreen />);
    expect(screen.getByTestId("convert-terms").props.maxLength).toBe(500);
  });

  it("does not offer a due date before today", async () => {
    await renderWithProviders(<BillingDocumentScreen />);
    await fireEvent.press(screen.getByTestId("convert-due"));
    const props = mockPickerProps[mockPickerProps.length - 1];
    expect(props.minimumDate).toEqual(parseIsoDate(toIsoDate(new Date())));
    expect(props.maximumDate).toEqual(new Date(2100, 11, 31));
  });
});
