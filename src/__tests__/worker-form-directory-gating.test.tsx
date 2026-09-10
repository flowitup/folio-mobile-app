import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import "@/i18n";
import { WorkerFormSheet } from "@/features/labor/labor-sheets";
import { NEW_PERSON } from "@/lib/labor/company-directory-candidates";

// Who may see the company directory at all, and when the picker mounts. Split from
// worker-form-directory.test.tsx: too many renders in one file and the later tests stop
// seeing their own options.

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const PERSONS_PATH = "/api/v1/companies/{company_id}/persons";
const WORKERS_PATH = "/api/v1/projects/{project_id}/workers";

/** The directory is a company admin/manager surface — the persona decides whether it loads. */
let mockCompanyRole: "admin" | "manager" | "member" = "admin";
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      email: "qa@example.com",
      permissions: [],
      companies: [{ id: "c1", legal_name: "Folio QA", role: mockCompanyRole }],
      is_platform_ops: false,
    },
  }),
}));

const mockGet = jest.fn();
jest.mock("@/api/client", () => ({
  api: { GET: (...args: unknown[]) => mockGet(...args) },
}));

// A GET that never settles leaks its Jest worker at teardown: capture the resolver and
// settle it in afterEach (same pattern as company-member-grants-sheet.test.tsx).
let pendingResolve: ((value: unknown) => void) | null = null;

async function renderSheet(companyId: string | null = "c1") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>
        <WorkerFormSheet
          projectId="proj-1"
          companyId={companyId}
          submitting={false}
          onSubmit={jest.fn()}
        />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe("WorkerFormSheet — directory access", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockCompanyRole = "admin";
    mockGet.mockImplementation((path: string) => {
      if (path === WORKERS_PATH)
        return Promise.resolve({ data: { workers: [], total: 0 } });
      return Promise.resolve({ data: { items: [] } });
    });
  });

  afterEach(() => {
    pendingResolve?.({ data: { items: [] } });
    pendingResolve = null;
  });

  it("never issues the directory request for a plain company member", async () => {
    mockCompanyRole = "member";

    await renderSheet();
    await waitFor(() => expect(screen.getByTestId("worker-name")).toBeTruthy());

    expect(screen.queryByTestId("worker-person")).toBeNull();
    expect(
      mockGet.mock.calls.filter(([path]) => path === PERSONS_PATH),
    ).toHaveLength(0);
  });

  it("stays on the manual form when the project has no company", async () => {
    await renderSheet(null);
    await waitFor(() => expect(screen.getByTestId("worker-name")).toBeTruthy());

    expect(screen.queryByTestId("worker-person")).toBeNull();
    expect(
      mockGet.mock.calls.filter(([path]) => path === PERSONS_PATH),
    ).toHaveLength(0);
  });

  it("mounts the picker before the directory answers, never as a late nested sheet", async () => {
    // Regression guard: a bottom sheet that appears while its parent is already open
    // corrupts gorhom's stack — the next dismiss closes both and the form never re-opens.
    // The picker must mount with the form, not with its data.
    mockGet.mockImplementation((path: string) => {
      if (path === PERSONS_PATH)
        return new Promise((resolve) => {
          pendingResolve = resolve;
        });
      if (path === WORKERS_PATH)
        return Promise.resolve({ data: { workers: [], total: 0 } });
      return Promise.resolve({ data: {} });
    });

    await renderSheet();

    expect(screen.getByTestId("worker-person")).toBeTruthy();
    // Until the directory answers, the only offer is "someone new".
    expect(
      screen.getByTestId(`worker-person-option-${NEW_PERSON}`),
    ).toBeTruthy();
  });
});
