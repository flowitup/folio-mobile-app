import { fireEvent, screen } from "@testing-library/react-native";

import "@/i18n";
import { InvoiceForm } from "@/features/invoices/invoice-form";
import type { Invoice } from "@/features/invoices/invoice-types";
import { currentMonth } from "@/lib/format/date";
import { renderWithProviders } from "./helpers/release-qa-fixtures";

/**
 * What the expense form sends on edit: an emptied notes / address field goes as "" (the API
 * keeps a missing key), and a labor payment saved without a service month keeps it empty
 * instead of being moved onto the current month.
 */
jest.mock("@react-native-community/datetimepicker", () => "DateTimePicker");
jest.mock("@/features/projects/use-project-can", () => ({
  useProjectCan: () => true,
}));
jest.mock("@/features/invoices/invoices-api", () => ({
  useInvoices: () => ({ data: { invoices: [] } }),
  usePaymentMethods: () => ({ data: [] }),
  useWorkers: () => ({ data: [] }),
}));

function invoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "inv-1",
    project_id: "p1",
    invoice_number: "INV-2026-0004",
    type: "others",
    issue_date: "2026-09-03",
    recipient_name: "Leroy",
    recipient_address: "1 rue X",
    notes: "Note à effacer",
    items: [
      {
        description: "Tape",
        quantity: 1,
        unit_price: 10,
        vat_rate: 0,
        total: 10,
      },
    ],
    total_amount: 10,
    created_by: "u1",
    created_at: "2026-09-03T08:00:00Z",
    updated_at: "2026-09-03T08:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    service_month: null,
    worker_id: null,
    refundable_status: null,
    paid_by_company: false,
    paid_by_personal: false,
    ...overrides,
  } as Invoice;
}

async function renderForm(initial?: Invoice) {
  const onSubmit = jest.fn();
  await renderWithProviders(
    <InvoiceForm
      projectId="p1"
      companyId={null}
      initial={initial}
      initialType={initial ? undefined : "labor"}
      submitting={false}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

describe("InvoiceForm edit payload", () => {
  it("sends emptied notes and address as empty strings", async () => {
    const onSubmit = await renderForm(invoice({}));
    await fireEvent.changeText(screen.getByTestId("invoice-notes"), "  ");
    await fireEvent.changeText(
      screen.getByTestId("invoice-recipient-address"),
      "",
    );
    await fireEvent.press(screen.getByTestId("invoice-submit"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ notes: "", recipient_address: "" }),
    );
  });

  it("keeps a labor payment without a service month unset", async () => {
    const onSubmit = await renderForm(
      invoice({
        type: "labor",
        recipient_name: "Ouvrier",
        service_month: null,
      }),
    );
    expect(screen.getByTestId("invoice-service-month-none")).toBeTruthy();
    expect(screen.queryByTestId("invoice-service-month")).toBeNull();
    await fireEvent.press(screen.getByTestId("invoice-submit"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ service_month: null }),
    );
  });

  it("lets the month be chosen, then cleared again, on edit", async () => {
    const onSubmit = await renderForm(
      invoice({
        type: "labor",
        recipient_name: "Ouvrier",
        service_month: null,
      }),
    );
    await fireEvent.press(screen.getByTestId("invoice-service-month-set"));
    await fireEvent.press(screen.getByTestId("invoice-submit"));
    expect(onSubmit).toHaveBeenLastCalledWith(
      expect.objectContaining({ service_month: `${currentMonth()}-01` }),
    );
    await fireEvent.press(screen.getByTestId("invoice-service-month-clear"));
    await fireEvent.press(screen.getByTestId("invoice-submit"));
    expect(onSubmit).toHaveBeenLastCalledWith(
      expect.objectContaining({ service_month: null }),
    );
  });

  it("keeps an existing service month on edit", async () => {
    const onSubmit = await renderForm(
      invoice({
        type: "labor",
        recipient_name: "Ouvrier",
        service_month: "2026-03-01",
      }),
    );
    await fireEvent.press(screen.getByTestId("invoice-submit"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ service_month: "2026-03-01" }),
    );
  });

  it("starts a new labor payment on the current month and leaves blank text out", async () => {
    const onSubmit = await renderForm();
    expect(screen.queryByTestId("invoice-service-month-clear")).toBeNull();
    await fireEvent.changeText(
      screen.getByTestId("invoice-recipient"),
      "Ouvrier",
    );
    await fireEvent.changeText(
      screen.getByTestId("invoice-item-0-description"),
      "Jour",
    );
    await fireEvent.changeText(
      screen.getByTestId("invoice-item-0-price"),
      "150",
    );
    await fireEvent.press(screen.getByTestId("invoice-submit"));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.service_month).toBe(`${currentMonth()}-01`);
    expect(payload.notes).toBeUndefined();
    expect(payload.recipient_address).toBeUndefined();
  });
});
