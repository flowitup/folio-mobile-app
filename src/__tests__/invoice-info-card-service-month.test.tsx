import { screen } from "@testing-library/react-native";

import i18n from "@/i18n";
import { InvoiceInfoCard } from "@/features/invoices/detail/invoice-detail-info-card";
import type { Invoice } from "@/features/invoices/invoice-types";

import { renderWithProviders } from "./helpers/release-qa-fixtures";

/** A labor payment's service month reads as a month name, never the raw `2026-10`. */
const invoice = {
  id: "inv-1",
  invoice_number: "INV-2026-0010",
  type: "labor",
  issue_date: "2026-10-05",
  service_month: "2026-10-01",
  total_amount: 1200,
  items: [],
} as unknown as Invoice;

afterAll(async () => {
  await i18n.changeLanguage("en");
});

describe("InvoiceInfoCard · service month", () => {
  it.each([
    ["en", "October 2026"],
    ["fr", "octobre 2026"],
  ])("shows the month in words in %s", async (language, label) => {
    await i18n.changeLanguage(language);
    const { unmount } = await renderWithProviders(
      <InvoiceInfoCard invoice={invoice} />,
    );
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByText("2026-10")).toBeNull();
    unmount();
  });
});
