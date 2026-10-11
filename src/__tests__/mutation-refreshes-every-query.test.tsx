/**
 * Listing the keys a write touches kept missing one, so a screen showed old data until the app
 * restarted. After any successful write every query is invalidated: the listed ones are
 * awaited, the rest refresh in the background.
 */

import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { useApiMutation } from "@/lib/query/use-api-mutation";
import "@/i18n";

jest.mock("@/components/ui/toast", () => ({ showToast: jest.fn() }));

let queryClient: QueryClient;
function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  queryClient = new QueryClient();
  for (const key of [
    ["projects", "p1", "tasks"],
    ["projects"],
    ["notifications"],
    ["billing", "refundable", true, "all"],
  ]) {
    queryClient.setQueryDefaults(key, { gcTime: Infinity });
    queryClient.setQueryData(key, { stale: true });
  }
});

const invalidated = (key: unknown[]) =>
  queryClient.getQueryState(key)?.isInvalidated;

it("invalidates queries nobody listed, and the listed ones", async () => {
  const { result } = await renderHook(
    () =>
      useApiMutation<void>({
        mutationFn: async () => undefined,
        invalidates: [["projects", "p1", "tasks"]],
      }),
    { wrapper: Providers },
  );
  await act(async () => {
    await result.current.mutateAsync();
    // TanStack batches its notifications on a timer: let them land inside act().
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(invalidated(["projects", "p1", "tasks"])).toBe(true);
  expect(invalidated(["projects"])).toBe(true);
  expect(invalidated(["notifications"])).toBe(true);
  expect(invalidated(["billing", "refundable", true, "all"])).toBe(true);
});

it("invalidates nothing when the write fails", async () => {
  const { result } = await renderHook(
    () =>
      useApiMutation<void>({
        mutationFn: async () => {
          throw new Error("boom");
        },
        onError: () => true,
      }),
    { wrapper: Providers },
  );
  await act(async () => {
    await result.current.mutateAsync().catch(() => undefined);
  });
  expect(invalidated(["projects"])).toBe(false);
});
