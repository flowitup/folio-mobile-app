import { screen } from "@testing-library/react-native";

import i18n from "@/i18n";
import { PurseCard } from "@/features/invoices/expense-cards";
import { formatMoney } from "@/lib/format/money";

import { renderWithProviders } from "./helpers/release-qa-fixtures";

/**
 * The company purse counts cash handed to people as spent (as on the web) and
 * says how much of that spend is cash advance.
 */
describe("PurseCard · cash advance", () => {
  it("shows what is left after the advance and the 'incl. cash advance' line", async () => {
    await renderWithProviders(
      <PurseCard
        testID="purse"
        label="Company"
        released={1000}
        spent={970}
        cashAdvanced={800}
        tone="company"
      />,
    );
    expect(screen.getByText(formatMoney(30))).toBeTruthy();
    expect(screen.getByTestId("purse-cash-advance").props.children).toBe(
      i18n.t("invoices.summary.cashAdvance", { amount: formatMoney(800) }),
    );
  });

  it("has no cash-advance line when nothing was advanced", async () => {
    await renderWithProviders(
      <PurseCard
        testID="purse"
        label="Personal"
        released={0}
        spent={0}
        tone="personal"
      />,
    );
    expect(screen.queryByTestId("purse-cash-advance")).toBeNull();
  });
});
