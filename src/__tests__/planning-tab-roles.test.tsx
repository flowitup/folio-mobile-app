import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";
import type { ComponentProps, ReactElement } from "react";

import i18n from "@/i18n";
import PlanningTab from "../../app/(app)/(tabs)/planning";
import { FloatingTabBar } from "@/components/shell/floating-tab-bar";
import type { Task } from "@/features/tasks/tasks-api";

/**
 * Planning per company role. The backend gates list / create / edit / move on `project:read`
 * and only `DELETE /tasks/{id}` on `project:update`, so a member in worker mode gets the same
 * board as a manager — a third tab next to Attendance / Salary — without the Delete button.
 */
const PROJECT_ID = "p1";
const MEMBER_SCOPED = [
  "project:read",
  "project:log_own_attendance",
  "project:view_roster",
  "user:read",
];
const MANAGER_SCOPED = [
  ...MEMBER_SCOPED,
  "project:update",
  "project:invite",
  "project:manage_users",
  "project:manage_labor",
  "project:manage_invoices",
  "project:view_pay",
];
const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let mockScopedPermissions: string[] = MEMBER_SCOPED;

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => undefined,
}));

// The JWT-wide list deliberately carries `project:update` (as it does for a manager elsewhere):
// the project's scoped `my_permissions` must decide alone — OR-ing the JWT back in would
// resurrect Delete for a member (or for a D8-denied manager).
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      email: "member@example.com",
      permissions: ["project:read", "project:update", "user:read"],
      companies: [{ id: "c1", name: "ANN ECO", role: "member" }],
    },
  }),
}));

jest.mock("@/components/shell/shell-context", () => ({
  ...jest.requireActual("@/components/shell/shell-context"),
  useShell: () => ({
    sheet: null,
    closeSheet: jest.fn(),
    openSheet: jest.fn(),
    toggleSheet: jest.fn(),
    tabBarHeight: 0,
    setTabBarHeight: jest.fn(),
  }),
}));

jest.mock("@/features/projects/selected-project", () => ({
  useSelectedProject: () => ({
    projectId: PROJECT_ID,
    project: {
      id: PROJECT_ID,
      name: "Chantier Arcueil",
      my_permissions: mockScopedPermissions,
    },
    projects: [],
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    select: jest.fn(),
  }),
}));

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: (...args: unknown[]) => mockPost(...args),
    PUT: (...args: unknown[]) => mockPut(...args),
    PATCH: (...args: unknown[]) => mockPatch(...args),
    DELETE: (...args: unknown[]) => mockDelete(...args),
  },
}));

function ok(data: unknown) {
  return { data, response: { status: 200, statusText: "OK" } };
}

function task(id: string, title: string, position: number): Task {
  return {
    id,
    project_id: PROJECT_ID,
    title,
    description: null,
    status: "todo",
    priority: "high",
    assignee_id: null,
    due_date: null,
    labels: [],
    position,
    created_by: "u9",
    created_at: "2026-09-09T08:00:00Z",
    updated_at: "2026-09-09T08:00:00Z",
  };
}
const TASKS = [task("t1", "Poser le carrelage", 1), task("t2", "Joints", 2)];

let queryClient: QueryClient;
async function renderWithProviders(ui: ReactElement) {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </SafeAreaProvider>,
  );
}

/** react-navigation tab-bar props for the project navigator sitting on the first route. */
function tabBarProps(): ComponentProps<typeof FloatingTabBar> {
  const routes = ["index", "expenses", "labor", "planning"].map((name) => ({
    key: `${name}-key`,
    name,
  }));
  return {
    state: { index: 0, routes },
    navigation: {
      emit: jest.fn(() => ({ defaultPrevented: false })),
      navigate: jest.fn(),
    },
  } as unknown as ComponentProps<typeof FloatingTabBar>;
}

function callsTo(mock: jest.Mock, path: string) {
  return mock.mock.calls.filter((call) => call[0] === path);
}

beforeEach(() => {
  for (const mock of [mockGet, mockPost, mockPut, mockPatch, mockDelete])
    mock.mockReset();
  mockGet.mockImplementation(async (path: string) =>
    path === "/api/v1/projects/{project_id}/tasks"
      ? ok({ tasks: TASKS })
      : ok({ notifications: [], items: [], total: 0 }),
  );
  mockPost.mockImplementation(async () =>
    ok(task("t3", "Commander le sable", 3)),
  );
  mockPatch.mockImplementation(async () => ok({ ...TASKS[0], status: "done" }));
});

// `gcTime: 0` leaves a garbage-collection timer behind otherwise (jest open-handle warning).
afterEach(() => {
  queryClient?.clear();
});

describe("planning tab · member (worker mode)", () => {
  beforeEach(() => {
    mockScopedPermissions = MEMBER_SCOPED;
  });

  it("renders the board with the project's tasks and the create button", async () => {
    await renderWithProviders(<PlanningTab />);

    expect(await screen.findByTestId("task-list")).toBeTruthy();
    expect(screen.getByText("Poser le carrelage")).toBeTruthy();
    expect(screen.getByText("Joints")).toBeTruthy();
    expect(screen.getByTestId("task-create")).toBeTruthy();
    expect(
      callsTo(mockGet, "/api/v1/projects/{project_id}/tasks")[0]?.[1],
    ).toEqual({ params: { path: { project_id: PROJECT_ID } } });
  });

  it("opens a task for editing without a Delete button (DELETE needs project:update)", async () => {
    await renderWithProviders(<PlanningTab />);
    await screen.findByTestId("task-list");

    await fireEvent.press(screen.getByTestId("task-t1"));

    expect(screen.getByTestId("task-submit")).toBeTruthy();
    expect(screen.getByTestId("task-up-t1")).toBeTruthy();
    expect(screen.getByTestId("task-down-t1")).toBeTruthy();
    expect(screen.queryByTestId("task-delete-t1")).toBeNull();
  });

  it("creates a task from the sheet (POST needs only project:read)", async () => {
    await renderWithProviders(<PlanningTab />);
    await screen.findByTestId("task-list");

    await fireEvent.press(screen.getByTestId("task-create"));
    await fireEvent.changeText(
      screen.getByTestId("task-title"),
      "Commander le sable",
    );
    await fireEvent.press(screen.getByTestId("task-submit"));

    await waitFor(() =>
      expect(
        callsTo(mockPost, "/api/v1/projects/{project_id}/tasks"),
      ).toHaveLength(1),
    );
    expect(
      callsTo(mockPost, "/api/v1/projects/{project_id}/tasks")[0][1],
    ).toEqual({
      params: { path: { project_id: PROJECT_ID } },
      body: {
        title: "Commander le sable",
        description: null,
        priority: "medium",
        status: "todo",
        due_date: null,
        labels: [],
        assignee_id: null,
      },
    });
  });

  it("marks a task done through the move route", async () => {
    await renderWithProviders(<PlanningTab />);
    await screen.findByTestId("task-list");

    await fireEvent.press(screen.getByTestId("task-toggle-t1"));

    await waitFor(() =>
      expect(callsTo(mockPatch, "/api/v1/tasks/{task_id}/move")).toHaveLength(
        1,
      ),
    );
    expect(callsTo(mockPatch, "/api/v1/tasks/{task_id}/move")[0][1]).toEqual({
      params: { path: { task_id: "t1" } },
      body: { status: "done", before_id: null, after_id: null },
    });
  });

  it("gets Planning as a worker tab next to Attendance / Salary / Profile, still no Menu", async () => {
    await renderWithProviders(<FloatingTabBar {...tabBarProps()} />);

    expect(screen.getByTestId("tab-index")).toBeTruthy();
    expect(screen.getByTestId("tab-expenses")).toBeTruthy();
    expect(screen.getByTestId("tab-labor")).toBeTruthy();
    expect(screen.getByTestId("tab-planning")).toBeTruthy();
    expect(screen.queryByTestId("tab-menu")).toBeNull();
    expect(screen.getByTestId("tab-planning").props.accessibilityLabel).toBe(
      i18n.t("tabs.planning"),
    );
  });
});

describe("planning tab · manager", () => {
  beforeEach(() => {
    mockScopedPermissions = MANAGER_SCOPED;
  });

  it("keeps the Delete button in the edit sheet", async () => {
    await renderWithProviders(<PlanningTab />);
    await screen.findByTestId("task-list");

    await fireEvent.press(screen.getByTestId("task-t1"));

    expect(screen.getByTestId("task-delete-t1")).toBeTruthy();
  });

  it("keeps the four project tabs plus the Menu", async () => {
    await renderWithProviders(<FloatingTabBar {...tabBarProps()} />);

    expect(screen.getByTestId("tab-labor")).toBeTruthy();
    expect(screen.getByTestId("tab-planning")).toBeTruthy();
    expect(screen.getByTestId("tab-menu")).toBeTruthy();
  });
});
