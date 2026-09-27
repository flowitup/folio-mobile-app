import { screen } from "@testing-library/react-native";

import i18n from "@/i18n";
import { ok, renderWithProviders } from "./helpers/release-qa-fixtures";

import ExpensesTab from "../../app/(app)/(tabs)/expenses";
import { WorkerSalaryTab } from "@/features/labor/worker-salary-tab";
import type { Worker } from "@/features/labor/labor-types";

/**
 * Worker mode · Lương for a company member nobody linked to a worker. The backend narrows the
 * worker list to that account, so it answers empty — and the shared salaries section then says
 * the site has no workers, which is about the site rather than about the reader. The tab has to
 * say what the attendance and profile tabs say: your account is not linked yet.
 */
const PROJECT_ID = "p1";

const LINKED: Worker = {
  id: "w-1",
  project_id: PROJECT_ID,
  name: "Minh Worker",
  phone: "+33 6 12 34 56 78",
  daily_rate: 150,
  is_active: true,
  created_at: "2026-03-01T08:00:00Z",
  user_id: "u-member",
};

let mockWorkers: Worker[] = [];

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
      id: PROJECT_ID,
      name: "Chantier Arcueil",
      company_id: "c1",
      // No `project:manage_labor`: this is the worker shell.
      my_permissions: ["project:read", "project:log_own_attendance"],
    };
    return {
      projects: [project],
      project,
      projectId: PROJECT_ID,
      isPending: false,
      isError: false,
      refetch: jest.fn(),
      select: jest.fn(),
    };
  },
}));

const mockGet = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: jest.fn(),
    PUT: jest.fn(),
    PATCH: jest.fn(),
    DELETE: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockWorkers = [];
  mockGet.mockImplementation(async (path: string) => {
    switch (path) {
      case "/api/v1/projects/{project_id}/workers":
        return ok({ workers: mockWorkers, total: mockWorkers.length });
      case "/api/v1/notifications":
        return ok({ items: [], attendance_pending: [] });
      case "/api/v1/projects/{project_id}/labor-monthly-summary":
        return ok({ rows: [] });
      case "/api/v1/projects/{project_id}/invoices":
        return ok({ invoices: [], total: 0 });
      default:
        return ok({});
    }
  });
});

describe("worker salary tab without a linked worker", () => {
  // The shell keeps a member nobody linked on the full project screens (#100), so the tab is
  // rendered directly: what is under test is its own not-linked card.
  it("tells the member their account is not linked yet", async () => {
    await renderWithProviders(<WorkerSalaryTab />);

    expect(await screen.findByTestId("worker-salary-title")).toBeTruthy();
    expect(
      await screen.findByTestId("worker-salary-not-linked"),
    ).toHaveTextContent(i18n.t("worker.notLinked"));
  });

  it("keeps the salaries section for a worker the account is linked to", async () => {
    mockWorkers = [LINKED];

    await renderWithProviders(<ExpensesTab />);

    expect(await screen.findByTestId("worker-salary-title")).toBeTruthy();
    // Awaiting the picker lets the workers query settle inside act(), which is also what proves
    // the shared salaries section — not the not-linked card — is what rendered.
    expect(await screen.findByTestId("salaries-worker")).toBeTruthy();
    expect(screen.queryByTestId("worker-salary-not-linked")).toBeNull();
  });
});
