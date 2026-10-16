/**
 * Regression review #6: logging one worker's day must ask the API for the cross-site
 * double-booking check (opt-in server side for older apps), so its 409 actually fires.
 */

import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { api } from "@/api/client";
import { useLogAttendance } from "@/features/labor/labor-api";
import "@/i18n";

jest.mock("@/api/client", () => ({
  api: {
    POST: jest.fn(async () => ({
      data: { id: "e1" },
      response: { status: 201, ok: true },
    })),
  },
}));
jest.mock("@/components/ui/toast", () => ({ showToast: jest.fn() }));

function Providers({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { mutations: { gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const sentBody = () =>
  (
    jest.mocked(api.POST).mock.calls.at(-1) as unknown as [
      string,
      { body: Record<string, unknown> },
    ]
  )[1].body;

it("asks for the conflict check when logging one worker's day", async () => {
  const { result } = await renderHook(() => useLogAttendance("p1"), {
    wrapper: Providers,
  });
  await act(async () => {
    await result.current.mutateAsync({
      worker_id: "w1",
      date: "2026-10-16",
      shift_type: "full",
    });
  });
  expect(sentBody()).toMatchObject({ check_conflicts: true, worker_id: "w1" });
});

it("passes the user's acknowledgement through", async () => {
  const { result } = await renderHook(() => useLogAttendance("p1"), {
    wrapper: Providers,
  });
  await act(async () => {
    await result.current.mutateAsync({
      worker_id: "w1",
      date: "2026-10-16",
      shift_type: "full",
      acknowledge_conflicts: true,
    });
  });
  expect(sentBody()).toMatchObject({
    check_conflicts: true,
    acknowledge_conflicts: true,
  });
});
