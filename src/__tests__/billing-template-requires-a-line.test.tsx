import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import i18n from "@/i18n";
import { BillingTemplateForm } from "@/features/billing/billing-template-form";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

jest.mock("@/api/client", () => ({
  api: { GET: jest.fn().mockResolvedValue({ data: { items: [] } }) },
}));

async function renderForm(onSubmit: jest.Mock) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>
        <BillingTemplateForm submitting={false} onSubmit={onSubmit} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

/**
 * A template exists to seed a document's lines, and the lines area has always told the user
 * to add at least one — but nothing enforced it, so an empty template saved happily. Its
 * sibling, the billing document form, has always enforced the same rule.
 */
describe("billing template lines", () => {
  it("refuses to save a template with no lines, and says why", async () => {
    const onSubmit = jest.fn();
    await renderForm(onSubmit);

    await fireEvent.changeText(
      screen.getByTestId("template-name"),
      "Standard devis",
    );
    await fireEvent.press(screen.getByTestId("template-submit"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getAllByText(i18n.t("billing.form.errors.atLeastOneItem")).length,
    ).toBeGreaterThan(0);
  });

  it("saves once a line is there", async () => {
    const onSubmit = jest.fn();
    await renderForm(onSubmit);

    await fireEvent.changeText(
      screen.getByTestId("template-name"),
      "Standard devis",
    );
    await fireEvent.press(screen.getByTestId("item-add"));
    await fireEvent.changeText(
      screen.getByTestId("item-description-0"),
      "Main d'oeuvre",
    );
    await fireEvent.press(screen.getByTestId("template-submit"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].items).toHaveLength(1);
  });
});
