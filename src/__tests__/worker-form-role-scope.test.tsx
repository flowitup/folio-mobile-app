/**
 * The worker form's roles are the project's company's: none are fetched before the company is
 * known (no flash of the primary company's list), they are refetched each time the form opens,
 * and a role the API refuses is cleared with a message under the field.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react-native";
import { createRef } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import i18n from "@/i18n";
import { WorkerFormSheet } from "@/features/labor/labor-sheets";
import type { WorkerFormHandle } from "@/features/labor/labor-sheets";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      email: "qa@example.com",
      permissions: [],
      companies: [{ id: "c1", legal_name: "Folio QA", role: "member" }],
      is_platform_ops: false,
    },
  }),
}));

const mockGet = jest.fn(async (path: string, _init?: unknown) => {
  if (path === "/api/v1/labor/roles")
    return { data: { roles: [{ id: "r1", name: "Thợ chính", color: "#111111", slug: "tho_chinh" }], palette: [] } };
  return { data: {} };
});
jest.mock("@/api/client", () => ({
  api: { GET: (path: string, init?: unknown) => mockGet(path, init) },
}));

const roleCalls = () => mockGet.mock.calls.filter(([path]) => path === "/api/v1/labor/roles");

async function renderForm(companyId: string | null) {
  const ref = createRef<WorkerFormHandle>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={client}>
        <WorkerFormSheet ref={ref} projectId="proj-1" companyId={companyId} submitting={false} onSubmit={jest.fn()} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  return { ref, view };
}

beforeEach(() => mockGet.mockClear());

describe("WorkerFormSheet — role scope", () => {
  it("fetches no role list until the project's company is known", async () => {
    await renderForm(null);
    expect(roleCalls()).toHaveLength(0);
  });

  it("fetches the project's company's roles, again when the form opens", async () => {
    const { ref } = await renderForm("c1");
    await act(async () => {});
    expect(roleCalls()).toHaveLength(1);
    expect(roleCalls()[0][1]).toEqual({ params: { query: { company_id: "c1" } } });
    await act(async () => ref.current?.open());
    await act(async () => {});
    expect(roleCalls().length).toBeGreaterThanOrEqual(2);
  });

  it("shows why a refused role was cleared", async () => {
    const { ref } = await renderForm("c1");
    await act(async () => ref.current?.open());
    await act(async () => ref.current?.rejectRole());
    expect(
      screen.getByText(i18n.t("labor.errors.roleUnavailable"), { exact: false }),
    ).toBeTruthy();
  });
});
