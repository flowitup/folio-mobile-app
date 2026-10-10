import { screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { ExpenseRow } from "@/features/invoices/expense-cards";
import { highlightRowTint } from "@/lib/invoices/invoice-totals";

import {
  INVOICE_MATERIALS,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";

/**
 * The highlight color picked on an expense tints its ledger row, as on the web; it used to show
 * only inside the detail picker.
 */
describe("ExpenseRow · highlight color", () => {
  function rowBackground() {
    const row = screen.getByTestId(`invoice-row-${INVOICE_MATERIALS.id}`);
    return StyleSheet.flatten(row.props.style)?.backgroundColor;
  }

  it("tints the row with the invoice's highlight color", async () => {
    await renderWithProviders(
      <ExpenseRow
        invoice={{ ...INVOICE_MATERIALS, highlight_color: "red" }}
        onPress={() => {}}
      />,
    );
    expect(rowBackground()).toBe(highlightRowTint("red"));
    expect(highlightRowTint("red")).toMatch(/^rgba\(/);
  });

  it("leaves an unhighlighted row untinted", async () => {
    await renderWithProviders(
      <ExpenseRow
        invoice={{ ...INVOICE_MATERIALS, highlight_color: null }}
        onPress={() => {}}
      />,
    );
    expect(rowBackground()).toBeUndefined();
  });
});
