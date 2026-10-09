import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import BillingDocumentScreen from "../../app/(app)/(tabs)/billing/documents/[docId]";
import {
  BILLING_DEVIS,
  SAFE_AREA_METRICS,
  ok,
} from "./helpers/release-qa-fixtures";

/**
 * A converted devis is locked only while its facture is live: the API releases it
 * once the facture is cancelled (converted_facture_status "cancelled"), and the
 * screen must not keep saying "cancel the invoice to change it".
 */
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ docId: "bd1" }),
  useFocusEffect: () => undefined,
}));

let mockDoc = BILLING_DEVIS;
const mockGet = jest.fn(async (path: string) =>
  path === "/api/v1/billing-documents/{doc_id}"
    ? ok(mockDoc)
    : ok({ projects: [], total: 0 }),
);
jest.mock("@/api/client", () => ({
  api: {
    GET: (path: string) => mockGet(path),
    PATCH: jest.fn(),
  },
}));

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>
        <BillingDocumentScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

it("keeps a devis locked while the facture made from it is live", async () => {
  mockDoc = {
    ...BILLING_DEVIS,
    status: "accepted",
    converted_to_facture_id: "fac-1",
    converted_facture_status: "sent",
  };
  await renderScreen();
  expect(await screen.findByTestId("doc-locked-by-facture")).toBeTruthy();
  expect(screen.queryByTestId("status-sent")).toBeNull();
});

it("releases the devis once that facture is cancelled", async () => {
  mockDoc = {
    ...BILLING_DEVIS,
    status: "accepted",
    converted_to_facture_id: "fac-1",
    converted_facture_status: "cancelled",
  };
  await renderScreen();
  expect(await screen.findByTestId("status-sent")).toBeTruthy();
  expect(screen.queryByTestId("doc-locked-by-facture")).toBeNull();
});
