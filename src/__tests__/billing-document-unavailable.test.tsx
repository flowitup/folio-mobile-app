import { QueryClient } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import i18n from "@/i18n";
import { billingKeys } from "@/features/billing/billing-documents-api";
import BillingDocumentScreen from "../../app/(app)/(tabs)/billing/documents/[docId]";
import { renderWithProviders } from "./helpers/release-qa-fixtures";

/**
 * A billing document deleted elsewhere (the API answers 404) says it no longer exists, with no
 * Retry that could only fail again, and the cached lists drop it. A server or network error
 * keeps the Retry.
 */
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ docId: "doc-gone" }),
  useFocusEffect: () => undefined,
}));

const mockGet = jest.fn();
jest.mock("@/api/client", () => ({
  api: { GET: (...args: unknown[]) => mockGet(...args) },
}));

function failWith(status: number, error: string) {
  return { error: { error }, response: { status, statusText: error } };
}

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

beforeEach(() => mockGet.mockReset());

describe("billing document that no longer exists", () => {
  it("says so without a Retry and refreshes the cached lists", async () => {
    mockGet.mockResolvedValue(failWith(404, "NotFound"));
    const invalidate = jest.spyOn(QueryClient.prototype, "invalidateQueries");
    await renderWithProviders(<BillingDocumentScreen />);

    await waitFor(() =>
      expect(screen.getByText(i18n.t("common.errors.notFound"))).toBeTruthy(),
    );
    expect(screen.queryByText(i18n.t("common.retry"))).toBeNull();
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
    const filters = invalidate.mock.calls[0][0]!;
    expect(filters.queryKey).toEqual(billingKeys.all);
    const matches = (queryKey: readonly unknown[]) =>
      filters.predicate!({ queryKey } as never);
    expect(matches(billingKeys.list("facture", null))).toBe(true);
    expect(matches(billingKeys.recent)).toBe(true);
    expect(matches(billingKeys.detail("doc-gone"))).toBe(false);
    invalidate.mockRestore();
    // The detail itself is not asked for again.
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("keeps Retry for a server error", async () => {
    mockGet.mockResolvedValue(failWith(503, "ServiceUnavailable"));
    await renderWithProviders(<BillingDocumentScreen />);

    await waitFor(() =>
      expect(screen.getByText(i18n.t("common.loadError"))).toBeTruthy(),
    );
    expect(screen.queryByText(i18n.t("common.errors.notFound"))).toBeNull();
    await fireEvent.press(screen.getByText(i18n.t("common.retry")));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
  });
});
