/**
 * Dismissing a bell reminder answers 204 with no body. The hook used to read that as a
 * failure: an error toast, and the reminder stayed in the sheet until the next poll.
 */

import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { showToast } from "@/components/ui/toast";
import { noteKeys, useDismissNotification } from "@/features/notes/notes-api";
import "@/i18n";

jest.mock("@/api/client", () => ({
  api: {
    // openapi-fetch returns { data: undefined } for a 204.
    POST: jest.fn(async () => ({
      data: undefined,
      response: { status: 204, statusText: "NO CONTENT", ok: true },
    })),
  },
}));
jest.mock("@/components/ui/toast", () => ({ showToast: jest.fn() }));

let queryClient: QueryClient;
function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  jest.mocked(showToast).mockClear();
  queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } },
  });
  queryClient.setQueryDefaults(noteKeys.notifications, { gcTime: Infinity });
  queryClient.setQueryData(noteKeys.notifications, { items: [], count: 1 });
});

it("treats the 204 as a success and refreshes the bell", async () => {
  const { result } = await renderHook(() => useDismissNotification(), {
    wrapper: Providers,
  });
  await act(async () => {
    await result.current.mutateAsync({ noteId: "n1" });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(showToast).not.toHaveBeenCalledWith(expect.anything(), "error");
  expect(queryClient.getQueryState(noteKeys.notifications)?.isInvalidated).toBe(
    true,
  );
});
