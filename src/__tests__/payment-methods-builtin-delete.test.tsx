import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import "@/i18n";
import { PaymentMethodsSection } from "@/features/companies/payment-methods-section";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const mockGet = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: jest.fn(),
    PATCH: jest.fn(),
    DELETE: jest.fn(),
  },
}));

const BUILTIN = {
  id: "pm-builtin",
  label: "AVN Construction SAS",
  is_active: true,
  is_builtin: true,
  is_company_payment: true,
  is_personal_payment: false,
};
const CUSTOM = {
  id: "pm-custom",
  label: "Wise",
  is_active: true,
  is_builtin: false,
  is_company_payment: false,
  is_personal_payment: true,
};

async function renderSection(readOnly = false) {
  mockGet.mockResolvedValue({ data: { items: [BUILTIN, CUSTOM] } });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>
        <PaymentMethodsSection companyId="c1" readOnly={readOnly} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.getByText("Wise")).toBeTruthy());
}

describe("payment methods delete affordance", () => {
  it("offers delete on a custom method but not on the company's built-in one", async () => {
    await renderSection();

    // The API answers a delete on a built-in method with 409 builtin_protected, so the
    // action could only ever end in an error banner — and the section's own help text
    // already tells the user the built-in one cannot be removed.
    expect(screen.queryByTestId("pm-delete-pm-builtin")).toBeNull();
    expect(screen.getByTestId("pm-delete-pm-custom")).toBeTruthy();
  });

  it("offers delete on neither when the viewer cannot manage the company", async () => {
    await renderSection(true);

    expect(screen.queryByTestId("pm-delete-pm-builtin")).toBeNull();
    expect(screen.queryByTestId("pm-delete-pm-custom")).toBeNull();
  });
});
