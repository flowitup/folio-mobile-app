import { fireEvent, screen } from "@testing-library/react-native";

import i18n from "@/i18n";
import { InvoiceForm } from "@/features/invoices/invoice-form";
import type { InvoiceType } from "@/features/invoices/invoice-types";
import { partyLabelKeys } from "@/features/invoices/party-labels";
import { renderWithProviders } from "./helpers/release-qa-fixtures";

/**
 * P-10: one flow, one word. A purchase is an expense paid to a supplier on the day it was
 * spent; a labor payment keeps its recipient. No "invoice" wording names an expense.
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

async function renderForm(initialType: InvoiceType) {
  await renderWithProviders(
    <InvoiceForm
      projectId="p1"
      companyId={null}
      initialType={initialType}
      submitting={false}
      onSubmit={jest.fn()}
    />,
  );
}

afterEach(() => i18n.changeLanguage("vi"));

describe("expense form wording", () => {
  it("names the supplier and the spend date on a materials expense", async () => {
    await i18n.changeLanguage("vi");
    await renderForm("materials_services");
    expect(screen.getByText("Nhà cung cấp")).toBeTruthy();
    expect(screen.getByText("Địa chỉ nhà cung cấp")).toBeTruthy();
    expect(screen.getByText("Ngày chi")).toBeTruthy();
    expect(screen.queryByText("Người nhận")).toBeNull();

    await fireEvent.press(screen.getByTestId("invoice-submit"));
    expect(screen.getByText("Cần nhập nhà cung cấp.")).toBeTruthy();
  });

  it("keeps the recipient on a labor payment", async () => {
    await i18n.changeLanguage("vi");
    await renderForm("labor");
    expect(screen.getByText("Người nhận")).toBeTruthy();
    expect(screen.queryByText("Nhà cung cấp")).toBeNull();
  });

  it("maps every type to its counterparty keys", () => {
    expect(partyLabelKeys("others").name).toBe("invoices.form.supplier");
    expect(partyLabelKeys("return").address).toBe(
      "invoices.form.supplierAddress",
    );
    expect(partyLabelKeys("labor").name).toBe("invoices.form.recipient");
    expect(partyLabelKeys("released_funds").date).toBe(
      "invoices.form.releaseDate",
    );
    expect(partyLabelKeys("materials_services").date).toBe(
      "invoices.form.issueDate",
    );
  });

  it.each(["vi", "fr", "en"])(
    "says expense, never invoice, along the overview → form → save flow (%s)",
    async (lang) => {
      await i18n.changeLanguage(lang);
      const invoiceWord = /hóa đơn|factur|invoice/i;
      for (const key of [
        "dashboard.overview.addInvoice",
        "invoices.created",
        "invoices.detail.title",
        "invoices.deleteConfirm",
        "invoices.form.create",
        "invoices.form.issueDate",
        "invoices.form.supplier",
      ])
        expect(i18n.t(key, { number: "INV-1" })).not.toMatch(invoiceWord);
    },
  );
});
