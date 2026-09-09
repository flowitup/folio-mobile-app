import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";
import type { ReactElement } from "react";

import i18n from "@/i18n";
import LaborTab from "../../app/(app)/(tabs)/labor";
import { FloatingTabBar } from "@/components/shell/floating-tab-bar";
import type { Worker, WorkerRateChange } from "@/features/labor/labor-types";
import { formatMoney } from "@/lib/format/money";
import { toIsoDate } from "@/lib/format/date";

/**
 * Worker mode · Profile: a member (no `project:manage_labor`) lands on their own profile from
 * the Labor tab slot — identity, the rate in force today and the rate history the backend
 * narrows to their linked worker. A manager keeps the full labor screen.
 */
const PROJECT_ID = "p1";
const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const TODAY = toIsoDate(new Date());

const MINH: Worker = {
  id: "w-minh",
  project_id: PROJECT_ID,
  name: "Minh Worker",
  phone: "+33 6 12 34 56 78",
  daily_rate: 150,
  is_active: true,
  created_at: "2026-03-01T08:00:00Z",
  user_id: "u-member",
  role_name: "Thợ chính",
  role_color: "#5A7A4A",
};
const RATE_CHANGES: WorkerRateChange[] = [
  {
    id: "rc-2",
    worker_id: MINH.id,
    effective_date: "2026-08-01",
    daily_rate: 170,
    created_at: "2026-07-20T08:00:00Z",
  },
  {
    id: "rc-1",
    worker_id: MINH.id,
    effective_date: "2026-05-01",
    daily_rate: 160,
    created_at: "2026-04-20T08:00:00Z",
  },
];

let mockScoped: string[] = ["project:read", "project:log_own_attendance"];
let mockWorkers: Worker[] = [MINH];
let mockRateChanges: WorkerRateChange[] | Error = RATE_CHANGES;
let mockWorkersError: Error | null = null;

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => undefined,
}));

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u-member",
      email: "member@example.com",
      permissions: ["project:read", "user:read"],
      companies: [],
    },
  }),
}));

jest.mock("@/components/shell/shell-context", () => ({
  ...jest.requireActual("@/components/shell/shell-context"),
  useShell: () => ({
    sheet: null,
    openSheet: jest.fn(),
    toggleSheet: jest.fn(),
    closeSheet: jest.fn(),
    tabBarHeight: 72,
    setTabBarHeight: jest.fn(),
  }),
}));

jest.mock("@/features/projects/selected-project", () => ({
  useSelectedProject: () => {
    const project = {
      id: "p1",
      name: "Chantier Arcueil",
      company_id: "c1",
      my_permissions: mockScoped,
    };
    return {
      projects: [project],
      project,
      projectId: "p1",
      isPending: false,
      isError: false,
      refetch: jest.fn(),
      select: jest.fn(),
    };
  },
}));

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: (...args: unknown[]) => mockPost(...args),
    PUT: jest.fn(),
    PATCH: jest.fn(),
    DELETE: jest.fn(),
  },
}));

/** `toHaveTextContent` with a string is an exact match; this accepts the text anywhere. */
function containing(text: string): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

function ok(data: unknown) {
  return { data, response: { status: 200, statusText: "OK" } };
}

async function renderWithProviders(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockScoped = ["project:read", "project:log_own_attendance"];
  mockWorkers = [MINH];
  mockRateChanges = RATE_CHANGES;
  mockWorkersError = null;
  mockGet.mockImplementation(async (path: string) => {
    switch (path) {
      case "/api/v1/projects/{project_id}/workers":
        if (mockWorkersError) throw mockWorkersError;
        return ok({ workers: mockWorkers, total: mockWorkers.length });
      case "/api/v1/projects/{project_id}/workers/{worker_id}/rate-changes":
        if (mockRateChanges instanceof Error) throw mockRateChanges;
        return ok({ rate_changes: mockRateChanges });
      case "/api/v1/notifications":
        return ok({ items: [], attendance_pending: [] });
      // The manager screen reads these shapes on mount (`.months.find`, `.rows`).
      case "/api/v1/projects/{project_id}/labor-payments-summary":
        return ok({ months: [] });
      case "/api/v1/projects/{project_id}/labor-summary":
        return ok({ rows: [], total_days: 0, total_cost: 0 });
      case "/api/v1/projects/{project_id}/labor-entries":
        return ok({ entries: [], total: 0 });
      case "/api/v1/projects/{project_id}/invoices":
        return ok({ invoices: [], total: 0 });
      default:
        return ok({});
    }
  });
});

describe("worker profile tab", () => {
  it("is the third worker-mode tab, in the Labor slot, and the Menu item is gone", async () => {
    const routes = ["index", "expenses", "labor", "planning"].map((name) => ({
      key: `${name}-key`,
      name,
    }));
    const navigation = {
      emit: jest.fn(() => ({ defaultPrevented: false })),
      navigate: jest.fn(),
    };
    await renderWithProviders(
      <FloatingTabBar
        state={{ index: 0, routes } as never}
        navigation={navigation as never}
        descriptors={{} as never}
        insets={SAFE_AREA_METRICS.insets}
      />,
    );

    const tabs = screen
      .getAllByRole("tab")
      .map((node) => node.props.testID as string);
    expect(tabs).toEqual(["tab-index", "tab-expenses", "tab-labor"]);
    expect(screen.getByTestId("tab-labor").props.accessibilityLabel).toBe(
      i18n.t("tabs.profile"),
    );
    await fireEvent.press(screen.getByTestId("tab-labor"));
    expect(navigation.navigate).toHaveBeenCalledWith("labor");
  });

  it("shows the member's own identity, today's rate and the rate history with each step", async () => {
    await renderWithProviders(<LaborTab />);

    expect(await screen.findByTestId("worker-profile-title")).toBeTruthy();
    expect(screen.queryByTestId("labor-title")).toBeNull();
    expect(await screen.findByTestId("worker-profile-name")).toHaveTextContent(
      "Minh Worker",
    );
    expect(screen.getByTestId("worker-profile-role")).toHaveTextContent(
      "Thợ chính",
    );
    expect(screen.getByTestId("worker-profile-phone")).toHaveTextContent(
      "+33 6 12 34 56 78",
    );
    // No `current_daily_rate` in the payload: resolved from the latest change effective today.
    expect(await screen.findByTestId("worker-profile-rate")).toHaveTextContent(
      formatMoney(170),
    );
    // Read-only: a member never writes a rate change from here.
    expect(mockPost).not.toHaveBeenCalled();

    // Newest first, then the starting rate; deltas measured against the previous rate.
    expect(await screen.findByTestId("worker-rate-row-rc-2")).toBeTruthy();
    expect(screen.getByTestId("worker-rate-delta-rc-2")).toHaveTextContent(
      `+${formatMoney(10)}`,
    );
    expect(screen.getByTestId("worker-rate-delta-rc-1")).toHaveTextContent(
      `+${formatMoney(10)}`,
    );
    expect(screen.getByTestId("worker-rate-row-base")).toHaveTextContent(
      new RegExp(formatMoney(150).replace(/\s/g, "\\s")),
    );
    expect(screen.queryByTestId("worker-rate-delta-base")).toBeNull();
    expect(screen.queryByTestId("worker-rate-history-empty")).toBeNull();

    // Only the member's own worker is asked for.
    expect(mockGet).toHaveBeenCalledWith(
      "/api/v1/projects/{project_id}/workers/{worker_id}/rate-changes",
      expect.objectContaining({
        params: { path: { project_id: PROJECT_ID, worker_id: MINH.id } },
      }),
    );
  });

  it("explains that the starting rate still applies when no change was recorded", async () => {
    mockRateChanges = [];
    await renderWithProviders(<LaborTab />);

    expect(await screen.findByTestId("worker-rate-history-empty")).toBeTruthy();
    expect(screen.getByTestId("worker-profile-rate")).toHaveTextContent(
      formatMoney(150),
    );
    expect(screen.getByTestId("worker-rate-row-base")).toBeTruthy();
  });

  it("flags an upcoming change and a decrease without changing today's rate", async () => {
    mockRateChanges = [
      {
        id: "rc-next",
        worker_id: MINH.id,
        effective_date: "2999-01-01",
        daily_rate: 140,
        created_at: `${TODAY}T08:00:00Z`,
      },
    ];
    await renderWithProviders(<LaborTab />);

    expect(
      await screen.findByTestId("worker-rate-row-rc-next"),
    ).toHaveTextContent(containing(i18n.t("worker.profile.upcoming")));
    expect(screen.getByTestId("worker-rate-delta-rc-next")).toHaveTextContent(
      `−${formatMoney(10)}`,
    );
    expect(screen.getByTestId("worker-profile-rate")).toHaveTextContent(
      formatMoney(150),
    );
  });

  it("trusts the backend's current_daily_rate when it carries an amount", async () => {
    mockWorkers = [{ ...MINH, current_daily_rate: 165 }];
    await renderWithProviders(<LaborTab />);
    expect(await screen.findByTestId("worker-profile-rate")).toHaveTextContent(
      formatMoney(165),
    );
  });

  it("ignores the schema's 0 default for current_daily_rate and resolves the rate from the history", async () => {
    mockWorkers = [{ ...MINH, current_daily_rate: 0 }];
    await renderWithProviders(<LaborTab />);
    expect(await screen.findByTestId("worker-profile-rate")).toHaveTextContent(
      formatMoney(170),
    );
  });

  it("never falls back to another worker's row when none is linked to the account", async () => {
    // What a member granted `project:view_pay` (D8) receives: every worker, none of them theirs.
    mockWorkers = [
      { ...MINH, id: "w-other", user_id: "u-other", name: "Other Worker" },
    ];
    await renderWithProviders(<LaborTab />);

    expect(await screen.findByTestId("worker-not-linked")).toBeTruthy();
    expect(screen.queryByTestId("worker-profile-card")).toBeNull();
    expect(screen.queryByText("Other Worker")).toBeNull();
  });

  it("shows a retryable error, not the not-linked card, when the workers request fails", async () => {
    mockWorkersError = new Error("offline");
    await renderWithProviders(<LaborTab />);

    expect(await screen.findByTestId("error-state")).toBeTruthy();
    expect(screen.queryByTestId("worker-not-linked")).toBeNull();
    expect(screen.queryByTestId("worker-profile-card")).toBeNull();
  });

  it("shows the not-linked card and never asks for rate changes when no worker is linked", async () => {
    mockWorkers = [];
    await renderWithProviders(<LaborTab />);

    expect(await screen.findByTestId("worker-not-linked")).toBeTruthy();
    expect(screen.queryByTestId("worker-profile-card")).toBeNull();
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        "/api/v1/projects/{project_id}/workers",
        expect.anything(),
      ),
    );
    expect(mockGet).not.toHaveBeenCalledWith(
      "/api/v1/projects/{project_id}/workers/{worker_id}/rate-changes",
      expect.anything(),
    );
  });

  it("surfaces a history load error and withholds today's rate rather than showing the starting rate", async () => {
    mockRateChanges = new Error("boom");
    await renderWithProviders(<LaborTab />);

    expect(await screen.findByTestId("worker-profile-card")).toBeTruthy();
    expect(await screen.findByTestId("worker-rate-history-error")).toBeTruthy();
    expect(screen.getByTestId("worker-profile-rate")).toHaveTextContent("—");
  });

  it("keeps the full labor screen for a manager", async () => {
    mockScoped = ["project:read", "project:manage_labor"];
    await renderWithProviders(<LaborTab />);

    expect(await screen.findByTestId("labor-title")).toBeTruthy();
    expect(screen.queryByTestId("worker-profile-title")).toBeNull();
  });
});
