import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { ReactElement } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import i18n from "@/i18n";
import BillingDocumentScreen from "../../app/(app)/(tabs)/billing/documents/[docId]";
import {
  BILLING_DEVIS,
  SAFE_AREA_METRICS,
  ok,
} from "./helpers/release-qa-fixtures";

/**
 * The API refuses any change to a devis converted to a facture (409) until the facture is
 * cancelled. The screen used to offer the status buttons and the edit form anyway, and a tap
 * raised two toasts (the default one with the raw English API text, then the screen's own).
 */
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ docId: "bd1" }),
  useFocusEffect: () => undefined,
}));

const mockShowToast = jest.fn();
jest.mock("@/components/ui/toast", () => ({
  ...jest.requireActual("@/components/ui/toast"),
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

let mockDoc = BILLING_DEVIS;
const mockPatch = jest.fn(async () => ({
  error: {
    error: "Conflict",
    message:
      "Devis bd1 was converted to a facture: cancel the facture before changing the devis",
  },
  response: { status: 409, statusText: "Conflict" },
}));
const mockGet = jest.fn(async (path: string) =>
  path === "/api/v1/billing-documents/{doc_id}"
    ? ok(mockDoc)
    : ok({ projects: [], total: 0 }),
);
jest.mock("@/api/client", () => ({
  api: {
    GET: (path: string) => mockGet(path),
    PATCH: () => mockPatch(),
  },
}));

async function renderScreen(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockPush.mockClear();
  mockShowToast.mockClear();
});

it("shows a converted devis read-only, pointing to its facture", async () => {
  mockDoc = {
    ...BILLING_DEVIS,
    status: "accepted",
    converted_to_facture_id: "fac-1",
  };
  await renderScreen(<BillingDocumentScreen />);
  await screen.findByTestId("doc-locked-by-facture");
  expect(
    screen.getByText(i18n.t("billing.actions.convertedLocked")),
  ).toBeTruthy();
  expect(screen.queryByTestId("status-sent")).toBeNull();
  expect(screen.queryByTestId("doc-convert")).toBeNull();
  expect(screen.queryByTestId("doc-submit")).toBeNull();
  expect(screen.getByTestId("billing-doc-form").props.pointerEvents).toBe(
    "none",
  );
  // Viewing, sharing and duplicating stay available.
  expect(screen.getByTestId("doc-pdf")).toBeTruthy();
  expect(screen.getByTestId("doc-clone")).toBeTruthy();

  await fireEvent.press(screen.getByTestId("doc-open-facture"));
  expect(mockPush).toHaveBeenCalledWith("/billing/documents/fac-1");
});

it("keeps an accepted devis that was not converted editable", async () => {
  mockDoc = { ...BILLING_DEVIS, status: "accepted" };
  await renderScreen(<BillingDocumentScreen />);
  expect(await screen.findByTestId("status-sent")).toBeTruthy();
  expect(screen.getByTestId("doc-submit")).toBeTruthy();
  expect(screen.queryByTestId("doc-locked-by-facture")).toBeNull();
});

it("explains a refused status change with one localized toast", async () => {
  mockDoc = { ...BILLING_DEVIS, status: "accepted" };
  await renderScreen(<BillingDocumentScreen />);
  await fireEvent.press(await screen.findByTestId("status-sent"));
  await waitFor(() => expect(mockShowToast).toHaveBeenCalled());
  expect(mockShowToast).toHaveBeenCalledTimes(1);
  expect(mockShowToast).toHaveBeenCalledWith(
    i18n.t("billing.actions.invalidTransition"),
    "error",
  );
});
