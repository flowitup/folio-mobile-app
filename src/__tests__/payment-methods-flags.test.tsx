import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import "@/i18n";
import { PaymentMethodsSection } from "@/features/companies/payment-methods-section";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const mockGet = jest.fn();
const mockPatch = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: jest.fn(),
    PATCH: (...args: unknown[]) => mockPatch(...args),
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

beforeEach(() => {
  jest.clearAllMocks();
  mockPatch.mockResolvedValue({ data: {}, response: { status: 200 } });
});

async function renderSection(items: object[] = [BUILTIN, CUSTOM]) {
  mockGet.mockResolvedValue({ data: { items } });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>
        <PaymentMethodsSection companyId="c1" />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.getByText("Wise")).toBeTruthy());
}

function patchedBody(): Record<string, unknown> {
  expect(mockPatch).toHaveBeenCalledTimes(1);
  return (mockPatch.mock.calls[0][1] as { body: Record<string, unknown> }).body;
}

describe("payment methods deactivate affordance", () => {
  it("offers no deactivate on the built-in method, which the API never lets go inactive", async () => {
    await renderSection();

    // PATCH {is_active:false} on a built-in answers 409 builtin_protected.
    expect(screen.queryByTestId("pm-toggle-active-pm-builtin")).toBeNull();
    expect(screen.getByTestId("pm-toggle-active-pm-custom")).toBeTruthy();
  });

  it("still offers activate on a built-in that is somehow inactive", async () => {
    await renderSection([{ ...BUILTIN, is_active: false }, CUSTOM]);

    expect(screen.getByTestId("pm-toggle-active-pm-builtin")).toBeTruthy();
  });
});

describe("payment methods company / personal flags", () => {
  it("clears 'paid by company' when 'personal' is ticked", async () => {
    await renderSection();

    // The API refuses both flags at once (400 conflicting_payment_flags).
    await fireEvent.press(screen.getByTestId("pm-personal-pm-builtin"));

    await waitFor(() =>
      expect(patchedBody()).toEqual({
        is_personal_payment: true,
        is_company_payment: false,
      }),
    );
  });

  it("clears 'personal' when 'paid by company' is ticked", async () => {
    await renderSection();

    await fireEvent.press(screen.getByTestId("pm-company-pm-custom"));

    await waitFor(() =>
      expect(patchedBody()).toEqual({
        is_company_payment: true,
        is_personal_payment: false,
      }),
    );
  });

  it("unticking a flag leaves the other one alone", async () => {
    await renderSection();

    await fireEvent.press(screen.getByTestId("pm-personal-pm-custom"));

    await waitFor(() =>
      expect(patchedBody()).toEqual({ is_personal_payment: false }),
    );
  });
});
