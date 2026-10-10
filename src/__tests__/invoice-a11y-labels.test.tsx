import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { screen, within } from "@testing-library/react-native";
import { createRef } from "react";

import i18n from "@/i18n";
import { InvoiceAttachmentsCard } from "@/features/invoices/detail/invoice-detail-attachments";
import { InvoiceHighlightRow } from "@/features/invoices/detail/invoice-highlight-row";
import { InvoiceForm } from "@/features/invoices/invoice-form";

import { renderWithProviders } from "./helpers/release-qa-fixtures";

/**
 * Screen readers hear the highlight swatches by their colour name in the UI language (not the
 * API enum), with the current one selected, and the attachment "…" menu by the file it acts on.
 */
jest.mock("@react-native-community/datetimepicker", () => "DateTimePicker");
jest.mock("@/features/projects/use-project-can", () => ({
  useProjectCan: () => true,
}));
jest.mock("@/lib/files/pick", () => ({
  captureImage: jest.fn(),
  pickDocuments: jest.fn(),
  pickImages: jest.fn(),
}));
jest.mock("@/features/invoices/invoices-api", () => {
  const mutation = () => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
  });
  return {
    useInvoices: () => ({ data: { invoices: [] } }),
    usePaymentMethods: () => ({ data: [] }),
    useWorkers: () => ({ data: [] }),
    useInvoiceAttachments: () => ({
      data: [
        {
          id: "att-1",
          filename: "Ticket été.pdf",
          mime_type: "application/pdf",
          size_bytes: 2048,
          uploaded_at: "2026-10-09T18:04:43.480832",
        },
      ],
      isError: false,
      isPending: false,
      refetch: jest.fn(),
    }),
    useUploadAttachment: mutation,
    useRenameAttachment: mutation,
    useDeleteAttachment: mutation,
    openAttachment: jest.fn(),
  };
});

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

afterAll(async () => {
  await i18n.changeLanguage("en");
});

describe("highlight swatches", () => {
  it("names each colour in French on the detail row", async () => {
    await renderWithProviders(
      <InvoiceHighlightRow value="red" onChange={jest.fn()} />,
    );
    expect(
      screen.getByLabelText("Rouge").props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(
      screen.getByLabelText("Violet").props.accessibilityState,
    ).toMatchObject({ selected: false });
    expect(screen.queryByLabelText("red")).toBeNull();
  });

  it("gives the edit-form swatches and the ✕ a role, a name and a state", async () => {
    await renderWithProviders(
      <InvoiceForm
        projectId="p1"
        companyId={null}
        initialType="others"
        submitting={false}
        onSubmit={jest.fn()}
      />,
    );
    const none = screen.getByTestId("invoice-highlight-none");
    expect(none).toHaveProp("accessibilityRole", "button");
    expect(none).toHaveProp("accessibilityLabel", "Sans couleur");
    expect(none.props.accessibilityState).toMatchObject({ selected: true });
    const yellow = screen.getByTestId("invoice-highlight-yellow");
    expect(yellow).toHaveProp("accessibilityRole", "button");
    expect(yellow).toHaveProp("accessibilityLabel", "Jaune");
    expect(yellow.props.accessibilityState).toMatchObject({ selected: false });
  });
});

describe("attachment menu", () => {
  it("names the file and sits beside the open button, not inside it", async () => {
    await renderWithProviders(
      <InvoiceAttachmentsCard
        projectId="p1"
        invoiceId="inv-1"
        addSheet={createRef<BottomSheetModal>()}
      />,
    );
    const menu = screen.getByLabelText("Options pour Ticket été.pdf");
    expect(menu).toHaveProp("testID", "attachment-menu-att-1");
    expect(
      within(screen.getByTestId("attachment-open-att-1")).queryByTestId(
        "attachment-menu-att-1",
      ),
    ).toBeNull();
  });
});
