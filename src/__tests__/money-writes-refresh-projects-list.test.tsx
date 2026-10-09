/**
 * Home's "Unpaid labor" tile and the project switcher read the project's totals from the
 * projects LIST (["projects"]). Money writes used to invalidate only ["projects", id], which
 * the list key is not under, so Home kept the old figure after a labor payment.
 */

import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import {
  useAssignInvoiceWorker,
  useCreateInvoice,
  useDeleteInvoice,
  useSetRefundableStatus,
  useUpdateInvoice,
} from "@/features/invoices/invoices-api";
import { useLogAttendance } from "@/features/labor/labor-api";
import { projectKeys } from "@/features/projects/projects-api";
import "@/i18n";

const ok = { data: { id: "x" }, response: { status: 200, ok: true } };
jest.mock("@/api/client", () => ({
  api: {
    POST: jest.fn(async () => ok),
    PUT: jest.fn(async () => ok),
    PATCH: jest.fn(async () => ok),
    DELETE: jest.fn(async () => ({ response: { status: 204, ok: true } })),
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
  queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0 }, mutations: { gcTime: 0 } },
  });
  // Kept in the cache without an observer (Infinity sets no collection timer).
  queryClient.setQueryDefaults(projectKeys.all, { gcTime: Infinity });
  queryClient.setQueryData(projectKeys.all, { projects: [], total: 0 });
});

const listInvalidated = () =>
  queryClient.getQueryState(projectKeys.all)?.isInvalidated;

const cases: [
  string,
  () => { mutateAsync: (v: never) => Promise<unknown> },
  unknown,
][] = [
  ["create invoice", () => useCreateInvoice("p1"), { type: "labor" }],
  ["update invoice", () => useUpdateInvoice("p1", "i1"), { notes: "" }],
  [
    "assign a worker",
    () => useAssignInvoiceWorker("p1"),
    { invoiceId: "i1", workerId: "w1" },
  ],
  ["delete invoice", () => useDeleteInvoice("p1"), { invoiceId: "i1" }],
  [
    "set refund status",
    () => useSetRefundableStatus("p1"),
    { invoiceId: "i1", status: null },
  ],
  ["log a labor day", () => useLogAttendance("p1"), { worker_id: "w1" }],
];

it.each(cases)("%s refreshes the projects list", async (_name, hook, vars) => {
  const { result } = await renderHook(hook, { wrapper: Providers });
  expect(listInvalidated()).toBe(false);
  await act(async () => {
    await result.current.mutateAsync(vars as never);
    // TanStack batches its notifications on a timer: let them land inside act().
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(listInvalidated()).toBe(true);
});
