/**
 * The settings hub shows a count next to "Payment methods". The screen that row opens lists the
 * inactive methods too (with an "inactive" badge), so the hub has to count the same list: it used
 * to count only the active ones and showed "1" over a screen listing two methods.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import i18n from "@/i18n";
import SettingsHub from "../../app/(app)/(tabs)/settings/index";

const ACTIVE = { id: "pm1", label: "Carte", is_active: true };
const INACTIVE = { id: "pm2", label: "Chèque", is_active: false };

const ok = (data: unknown) => ({
  data,
  error: undefined,
  response: { ok: true, status: 200 },
});

const mockGet = jest.fn(
  async (
    path: string,
    options?: { params?: { query?: { include_inactive?: boolean } } },
  ) => {
    if (path === "/api/v1/companies")
      return ok({
        items: [
          {
            company: { id: "c1", legal_name: "Co A" },
            access: {
              is_primary: true,
              attached_at: "Fri, 09 Oct 2026 18:00:33 GMT",
              role: "admin",
            },
          },
        ],
      });
    if (path === "/api/v1/companies/{company_id}/payment-methods")
      return ok({
        items: options?.params?.query?.include_inactive
          ? [ACTIVE, INACTIVE]
          : [ACTIVE],
      });
    if (path === "/api/v1/labor/roles") return ok({ roles: [], palette: [] });
    throw new Error(`unexpected GET ${path}`);
  },
);
jest.mock("@/api/client", () => ({
  api: { GET: (...args: unknown[]) => mockGet(...(args as [string])) },
}));
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    user: { id: "u1", permissions: [], companies: [] },
    signOut: jest.fn(),
  }),
}));
jest.mock("@/theme/theme-preference", () => ({
  useThemePreference: () => ({ preference: "system" }),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let queryClient: QueryClient;

afterEach(() => {
  queryClient?.clear();
});

describe("Settings hub — payment methods count", () => {
  it("counts every method the payment methods screen lists, inactive ones included", async () => {
    await i18n.changeLanguage("en");
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={queryClient}>
          <SettingsHub />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    const row = screen.getByTestId("settings-payment-methods");
    expect(await within(row).findByText("2")).toBeTruthy();
  });
});
