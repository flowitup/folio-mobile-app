/**
 * Leaving a company, changing the primary company or joining one by code changes what
 * `/auth/me` says: `user.companies` (account sheet, admin gates) and `user.permissions`, which
 * are scoped to the primary company. Those live in the auth context, not the query cache, so
 * invalidating `["companies"]` alone left them stale until the app next came to the foreground.
 */

import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import {
  useDetachCompany,
  useJoinCompanyByCode,
  useSetPrimaryCompany,
} from "@/features/companies/companies-api";
import "@/i18n";

const mockRefreshUser = jest.fn(async () => undefined);
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: null, refreshUser: mockRefreshUser }),
}));

const ok = { data: {}, response: { status: 200, ok: true } };
const mockApi = {
  DELETE: jest.fn(async () => ({ response: { status: 204, ok: true } })),
  PUT: jest.fn(async () => ok),
  POST: jest.fn(async () => ({ ...ok, data: { id: "c2" } })),
};
jest.mock("@/api/client", () => ({
  api: {
    DELETE: (...args: unknown[]) => mockApi.DELETE(...(args as [])),
    PUT: (...args: unknown[]) => mockApi.PUT(...(args as [])),
    POST: (...args: unknown[]) => mockApi.POST(...(args as [])),
  },
}));

jest.mock("@/components/ui/toast", () => ({ showToast: jest.fn() }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

let queryClient: QueryClient;
function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } },
  });
});

// TanStack batches its notifications on a timer: let them land inside act().
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

async function runMutation<T>(
  useMutationHook: () => { mutateAsync: (variables: T) => Promise<unknown> },
  variables: T,
) {
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  const { result } = await renderHook(useMutationHook, { wrapper: Providers });
  await act(async () => {
    await result.current.mutateAsync(variables);
  });
  await settle();
  return invalidate.mock.calls.map(([filters]) => filters?.queryKey);
}

describe("company membership changes", () => {
  it("re-reads /auth/me after setting the primary company", async () => {
    const keys = await runMutation(useSetPrimaryCompany, { id: "c2" });

    expect(mockRefreshUser).toHaveBeenCalledTimes(1);
    expect(keys).toEqual(expect.arrayContaining([["companies"], ["projects"]]));
  });

  it("re-reads /auth/me after leaving a company", async () => {
    const keys = await runMutation(useDetachCompany, { id: "c2" });

    expect(mockRefreshUser).toHaveBeenCalledTimes(1);
    expect(keys).toEqual(expect.arrayContaining([["companies"], ["projects"]]));
  });

  it("re-reads /auth/me after joining a company by code", async () => {
    const keys = await runMutation(useJoinCompanyByCode, { code: "K7Q2M9XR" });

    expect(mockRefreshUser).toHaveBeenCalledTimes(1);
    expect(keys).toEqual(expect.arrayContaining([["companies"], ["projects"]]));
  });

  it("leaves /auth/me alone when the change fails", async () => {
    mockApi.PUT.mockResolvedValueOnce({
      error: { error: "Forbidden", message: "No" },
      response: { status: 403, ok: false, statusText: "Forbidden" },
    } as never);
    const { result } = await renderHook(useSetPrimaryCompany, {
      wrapper: Providers,
    });

    await act(async () => {
      await result.current.mutateAsync({ id: "c2" }).catch(() => undefined);
    });
    await settle();

    expect(mockRefreshUser).not.toHaveBeenCalled();
  });
});
