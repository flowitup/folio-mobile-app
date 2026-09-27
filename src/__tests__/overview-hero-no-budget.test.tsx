import { render, screen } from "@testing-library/react-native";

import i18n from "@/i18n";
import { OverviewHero } from "@/features/dashboard/overview-hero";
import { computeBudgetMetrics } from "@/lib/dashboard/overview-metrics";
import { formatMoney } from "@/lib/format/money";

/**
 * A project with no budget and no funds released yet, but some spending: "remaining" used to
 * read minus the spending next to a "0 % spent" ring.
 */
describe("overview hero · no budget, nothing released", () => {
  it("has nothing to measure the spending against", () => {
    expect(computeBudgetMetrics(null, 75.25, 0)).toMatchObject({
      hasDenominator: false,
      left: -75.25,
    });
    expect(computeBudgetMetrics(null, 75.25, 500).hasDenominator).toBe(true);
  });

  it("shows the amount spent, says there is no budget, and draws no percentage", async () => {
    await i18n.changeLanguage("en");
    await render(
      <OverviewHero
        budget={computeBudgetMetrics(null, 75.25, 0)}
        spentTotal={75.25}
        spentByCredits={0}
        spentPersonal={75.25}
        bankRemaining={null}
        onAddInvoice={() => {}}
        onAddRelease={() => {}}
        onPayLabor={() => {}}
      />,
    );

    expect(
      screen.getAllByText(i18n.t("invoices.summary.spent")).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(i18n.t("dashboard.remainingToSpend"))).toBeNull();
    expect(screen.getByTestId("overview-no-budget")).toHaveTextContent(
      i18n.t("dashboard.overview.noBudgetNoFunds"),
    );
    expect(screen.getByTestId("overview-ring-pct")).toHaveTextContent("—");
    expect(screen.queryByText(`-${formatMoney(75.25)}`)).toBeNull();
  });
});
