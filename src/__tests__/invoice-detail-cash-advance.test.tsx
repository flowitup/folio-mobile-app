import { screen } from "@testing-library/react-native";

import i18n from "@/i18n";
import { InvoiceDetailHeader } from "@/features/invoices/detail/invoice-detail-hero";
import type { Invoice } from "@/features/invoices/invoice-types";

import { renderWithProviders } from "./helpers/release-qa-fixtures";

/**
 * The detail header names a company cash advance (a released_funds row flagged
 * is_cash_advance) the way the ledger lists it: "Others", plus a cash-advance pill.
 */
const invoice = (partial: Partial<Invoice>) =>
  ({
    id: "inv-1",
    invoice_number: "INV-2026-0010",
    type: "released_funds",
    issue_date: "2026-09-10",
    total_amount: 800,
    items: [],
    ...partial,
  }) as Invoice;

describe("InvoiceDetailHeader · cash advance", () => {
  it("heads a cash advance as Others with the cash-advance pill", async () => {
    await renderWithProviders(
      <InvoiceDetailHeader
        invoice={invoice({ is_cash_advance: true })}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText(i18n.t("invoices.types.others"))).toBeTruthy();
    expect(
      screen.queryByText(i18n.t("invoices.types.released_funds")),
    ).toBeNull();
    expect(screen.getByTestId("invoice-detail-cash-advance")).toBeTruthy();
  });

  it("keeps a plain release headed with its own type", async () => {
    await renderWithProviders(
      <InvoiceDetailHeader invoice={invoice({})} onBack={() => {}} />,
    );
    expect(screen.queryByText(i18n.t("invoices.types.others"))).toBeNull();
    expect(screen.queryByTestId("invoice-detail-cash-advance")).toBeNull();
  });
});
