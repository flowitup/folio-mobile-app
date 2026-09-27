import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import i18n from "@/i18n";
import { AddMemberByPhoneSheet } from "@/features/companies/add-member-by-phone-sheet";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const mockPost = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: jest.fn().mockResolvedValue({ data: {} }),
    POST: (...args: unknown[]) => mockPost(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPost.mockResolvedValue({ data: {} });
});

async function renderSheet() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>
        <AddMemberByPhoneSheet companyId="c1" />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

/**
 * Sign-in is French-only. Sending the raw text let the backend answer, and its sentence is
 * English — which then showed up inside an otherwise translated screen.
 */
describe("adding a member by phone", () => {
  it("refuses a number that is not French, in the user's language", async () => {
    await renderSheet();

    await fireEvent.changeText(screen.getByTestId("add-member-phone"), "123");
    await fireEvent.press(screen.getByTestId("add-member-submit"));

    expect(mockPost).not.toHaveBeenCalled();
    expect(screen.getByText(i18n.t("login.invalidPhone"))).toBeTruthy();
  });

  it("sends a French number in E.164, however the user spaced it", async () => {
    await renderSheet();

    await fireEvent.changeText(
      screen.getByTestId("add-member-phone"),
      "06 99 88 77 66",
    );
    await fireEvent.press(screen.getByTestId("add-member-submit"));

    expect(mockPost).toHaveBeenCalledTimes(1);
    const body = (mockPost.mock.calls[0][1] as { body: { phone: string } })
      .body;
    expect(body.phone).toBe("+33699887766");
  });
});
