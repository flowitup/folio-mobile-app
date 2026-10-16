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
    expect(screen.getByTestId("purse-figure")).toHaveTextContent(
      `${formatMoney(30)} ${i18n.t("invoices.summary.left")}`,
    );
    expect(screen.getByTestId("purse-line")).toHaveTextContent(
      i18n.t("invoices.summary.purseLine", {
        released: formatMoney(1000),
        spent: formatMoney(970),
      }),
    );
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

describe("PurseCard · over and unfunded", () => {
  it("says a purse spent past its release is over, without capping the share", async () => {
    await renderWithProviders(
      <PurseCard
        testID="purse"
        label="Company"
        released={1000}
        spent={1250}
        tone="company"
      />,
    );
    expect(screen.getByTestId("purse-pct")).toHaveTextContent("125 %");
    expect(screen.getByTestId("purse-figure")).toHaveTextContent(
      `${formatMoney(250)} ${i18n.t("invoices.summary.overLower")}`,
    );
  });

  it("calls spend with nothing released 'not funded' instead of 0 %", async () => {
    await renderWithProviders(
      <PurseCard
        testID="purse"
        label="Personal"
        released={0}
        spent={366.12}
        tone="personal"
      />,
    );
    expect(screen.getByTestId("purse-pct")).toHaveTextContent(
      i18n.t("invoices.summary.unfunded"),
    );
    expect(screen.getByTestId("purse-figure")).toHaveTextContent(
      `${formatMoney(366.12)} ${i18n.t("invoices.summary.spentLower")}`,
    );
  });
});
