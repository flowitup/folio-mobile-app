/**
 * QA3 stale lists (Mac #20/#34/#40, class 2): what the app shows follows changes made elsewhere
 * without an app restart. The query client's defaults decide when a list is read again; the
 * focus manager (driven from `AppState` by the auth provider) refetches stale lists when the
 * app returns to the foreground; a company created or switched refreshes every company-scoped
 * list; the chat flag is no longer cached for the whole session.
 */

import {
  act,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import {
  focusManager,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { Text } from "react-native";

import { FEATURES_STALE_TIME_MS, useFeatures } from "@/features/chat/chat-api";
import {
  useCreateCompany,
  useSetPrimaryCompany,
} from "@/features/companies/companies-api";
import { ApiError } from "@/lib/query/api-error";
import {
  createAppQueryClient,
  DEFAULT_STALE_TIME_MS,
} from "@/lib/query/query-client";
import "@/i18n";

const mockRefreshUser = jest.fn(async () => undefined);
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: null, refreshUser: mockRefreshUser }),
}));

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: (...args: unknown[]) => mockPost(...args),
    PUT: (...args: unknown[]) => mockPut(...args),
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
  jest.clearAllMocks();
  queryClient = createAppQueryClient();
  // No garbage-collection timers left behind to keep Jest running after the tests.
  const defaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    queries: { ...defaults.queries, gcTime: Infinity },
    mutations: { ...defaults.mutations, gcTime: Infinity },
  });
});
afterEach(() => {
  queryClient.clear();
  focusManager.setFocused(undefined);
});

/** Makes a cached answer `ms` older, as if that much time had passed since it was read. */
function age(queryKey: unknown[], ms: number) {
  const query = queryClient.getQueryCache().find({ queryKey })!;
  query.setState({ dataUpdatedAt: query.state.dataUpdatedAt - ms });
}

/** The app goes to the background and comes back, as `AuthProvider` reports it. */
async function foreground() {
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
}

describe("app query client defaults", () => {
  it("keeps answers 30 s, refetches on focus and reconnect, retries only transient failures", () => {
    const queries = createAppQueryClient().getDefaultOptions().queries!;
    expect(DEFAULT_STALE_TIME_MS).toBe(30_000);
    expect(queries.staleTime).toBe(30_000);
    expect(queries.refetchOnWindowFocus).toBe(true);
    expect(queries.refetchOnReconnect).toBe(true);
    const retry = queries.retry as (count: number, error: unknown) => boolean;
    expect(retry(0, new ApiError(403, "Forbidden", "Forbidden"))).toBe(false);
    expect(retry(0, new ApiError(503, "Unavailable", "Unavailable"))).toBe(
      true,
    );
    expect(retry(1, new ApiError(503, "Unavailable", "Unavailable"))).toBe(
      false,
    );
  });
});

describe("refetch on foreground", () => {
  function Probe() {
    const roles = useQuery({
      queryKey: ["labor", "roles", "c1"],
      queryFn: async () =>
        (await mockGet("/api/v1/labor/roles")).data as string,
    });
    return <Text testID="roles">{roles.data ?? "…"}</Text>;
  }

  it("re-reads a list on screen once it is stale, not while it is fresh", async () => {
    mockGet.mockResolvedValue({ data: "Maçon" });
    const screen = await render(<Probe />, { wrapper: Providers });
    await waitFor(() =>
      expect(screen.getByTestId("roles")).toHaveTextContent("Maçon"),
    );
    expect(mockGet).toHaveBeenCalledTimes(1);

    age(["labor", "roles", "c1"], 10_000);
    await foreground();
    expect(mockGet).toHaveBeenCalledTimes(1);

    // Someone added a role on another device; the user comes back to the app later.
    mockGet.mockResolvedValue({ data: "Maçon, Peintre" });
    age(["labor", "roles", "c1"], DEFAULT_STALE_TIME_MS);
    await foreground();
    await waitFor(() =>
      expect(screen.getByTestId("roles")).toHaveTextContent("Maçon, Peintre"),
    );
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});

describe("chat feature flag", () => {
  it("is read again after a while, so a flag switched on shows without a force-quit", async () => {
    expect(Number.isFinite(FEATURES_STALE_TIME_MS)).toBe(true);
    mockGet.mockResolvedValue({
      data: { chat: false },
      response: { ok: true, status: 200 },
    });
    const { result } = await renderHook(() => useFeatures(), {
      wrapper: Providers,
    });
    await waitFor(() => expect(result.current.data).toEqual({ chat: false }));

    mockGet.mockResolvedValue({
      data: { chat: true },
      response: { ok: true, status: 200 },
    });
    age(["features"], DEFAULT_STALE_TIME_MS + 1);
    await foreground();
    // Still within its own (longer) stale time: no request for a flag.
    expect(mockGet).toHaveBeenCalledTimes(1);

    age(["features"], FEATURES_STALE_TIME_MS);
    await foreground();
    await waitFor(() => expect(result.current.data).toEqual({ chat: true }));
  });
});

describe("company created or switched", () => {
  const companyScoped = [
    ["labor", "roles", "c1"],
    ["companies", "c1", "payment-methods", "active"],
    ["billing", "templates", "list", "all", "default"],
    ["companies", "c1", "persons"],
    ["projects"],
    ["projects", "p1", "workers"],
    ["library", "products", "c1", {}],
    ["inventory", "items", "c1"],
  ];

  beforeEach(() => {
    for (const key of companyScoped) {
      queryClient.setQueryDefaults(key, { gcTime: Infinity });
      queryClient.setQueryData(key, { cached: true });
    }
  });

  const settle = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

  it("creating a company marks every company-scoped list stale and re-reads the user", async () => {
    mockGet.mockResolvedValue({
      data: { items: [] },
      response: { ok: true, status: 200 },
    });
    mockPost.mockResolvedValue({
      data: { id: "c2" },
      response: { ok: true, status: 201 },
    });
    const { result } = await renderHook(() => useCreateCompany(), {
      wrapper: Providers,
    });
    await act(async () => {
      await result.current.mutateAsync({
        legal_name: "QA3 B",
        address: "1 rue",
      });
    });
    await settle();
    for (const key of companyScoped)
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    expect(mockRefreshUser).toHaveBeenCalled();
  });

  it("switching the primary company does the same", async () => {
    mockGet.mockResolvedValue({
      data: { items: [] },
      response: { ok: true, status: 200 },
    });
    mockPut.mockResolvedValue({
      data: {},
      response: { ok: true, status: 200 },
    });
    const { result } = await renderHook(() => useSetPrimaryCompany(), {
      wrapper: Providers,
    });
    await act(async () => {
      await result.current.mutateAsync({ id: "c2" });
    });
    await settle();
    for (const key of companyScoped)
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    expect(mockRefreshUser).toHaveBeenCalled();
  });
});
