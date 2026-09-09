import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";

import "@/i18n";
import LaborTab from "../../app/(app)/(tabs)/labor";
import { WorkerAttendanceTab } from "@/features/labor/worker-attendance-tab";
import type { LaborEntry, Worker } from "@/features/labor/labor-types";
import { formatMoney } from "@/lib/format/money";
import {
  ENTRIES,
  ENTRY_MINH_PENDING,
  INVOICE_LABOR_UNASSIGNED,
  TODAY,
  WORKERS,
  WORKER_MINH,
  WORKER_TUAN,
  answerGet,
  callsTo,
  containing,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";
import type { Persona } from "./helpers/release-qa-fixtures";

/**
 * Labor tab per company role: a manager gets attendance / workers / payments, and can record
 * a payment only while holding `project:manage_invoices`; a member gets worker mode — their
 * own days, the day roster without money, and a one-tap self-log that refreshes the month.
 */
let mockPersona: Persona = persona("manager");
let mockParams: { segment?: string } = {};
// Focus callbacks registered through expo-router, replayed by the refetch-on-focus test.
let mockFocusCallbacks: (() => void)[] = [];
let mockEntries: LaborEntry[] = ENTRIES;
let mockWorkers: Worker[] = WORKERS;
const mockRouter = {
  push: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: () => true,
};

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void) => {
    mockFocusCallbacks.push(callback);
  },
}));

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: mockPersona.user }),
}));

jest.mock("@/components/shell/shell-context", () => {
  const fixtures = jest.requireActual("./helpers/release-qa-fixtures");
  return {
    ...jest.requireActual("@/components/shell/shell-context"),
    useShell: () => fixtures.SHELL,
  };
});

jest.mock("@/features/projects/selected-project", () => {
  const fixtures = jest.requireActual("./helpers/release-qa-fixtures");
  return { useSelectedProject: () => fixtures.selectedProject(mockPersona) };
});

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

beforeEach(() => {
  jest.clearAllMocks();
  mockFocusCallbacks = [];
  mockParams = {};
  mockEntries = ENTRIES;
  mockWorkers = WORKERS;
  mockGet.mockImplementation((path: string, options?: unknown) =>
    answerGet(() => mockPersona, {
      entries: mockEntries,
      workers: mockWorkers,
    })(path, options as never),
  );
});

describe("labor tab · manager", () => {
  beforeEach(() => {
    mockPersona = persona("manager");
  });

  it("shows the month KPIs, the calendar day card and the log button", async () => {
    await renderWithProviders(<LaborTab />);

    expect(await screen.findByTestId("labor-title")).toBeTruthy();
    expect(await screen.findByTestId("labor-kpi-days")).toHaveTextContent(
      /^2\.5$/,
    );
    expect(screen.getByTestId("labor-kpi-cost")).toHaveTextContent(
      containing(formatMoney(330)),
    );
    // Owed 330 − paid 100 (Tuan's labor invoice) = 230 still unpaid this month.
    expect(screen.getByTestId("labor-kpi-unpaid")).toHaveTextContent(
      containing(formatMoney(230)),
    );
    expect(await screen.findByTestId("labor-day-card")).toBeTruthy();
    expect(screen.getByTestId("day-log")).toBeTruthy();
    expect(screen.queryByTestId("worker-attendance-title")).toBeNull();
  });

  it("lists every worker with their days on the Workers segment", async () => {
    await renderWithProviders(<LaborTab />);
    await screen.findByTestId("labor-title");

    await fireEvent.press(screen.getByTestId("labor-tab-workers"));
    expect(
      await screen.findByTestId(`worker-card-${WORKER_MINH.id}`),
    ).toBeTruthy();
    expect(screen.getByTestId(`worker-card-${WORKER_TUAN.id}`)).toBeTruthy();
    expect(screen.getByTestId("worker-add")).toBeTruthy();
  });

  it("offers to record payments and surfaces unassigned labor invoices (deep link segment=payments)", async () => {
    mockParams = { segment: "payments" };
    await renderWithProviders(<LaborTab />);

    expect(await screen.findByTestId("payment-record-all")).toHaveTextContent(
      containing(formatMoney(230)),
    );
    expect(screen.getByTestId(`payment-record-${WORKER_TUAN.id}`)).toBeTruthy();
    expect(screen.getByTestId(`payment-record-${WORKER_MINH.id}`)).toBeTruthy();
    expect(
      screen.getByTestId(`unassigned-invoice-${INVOICE_LABOR_UNASSIGNED.id}`),
    ).toBeTruthy();

    await fireEvent.press(
      screen.getByTestId(`unassigned-invoice-${INVOICE_LABOR_UNASSIGNED.id}`),
    );
    expect(mockRouter.push).toHaveBeenCalledWith(
      `/projects/p1/invoices/${INVOICE_LABOR_UNASSIGNED.id}`,
    );
  });
});

describe("labor tab · manager denied project:manage_invoices (D8)", () => {
  beforeEach(() => {
    mockPersona = persona("manager", { deny: ["project:manage_invoices"] });
    mockParams = { segment: "payments" };
  });

  it("keeps the payment rows readable but hides the record button", async () => {
    await renderWithProviders(<LaborTab />);

    expect(
      await screen.findByTestId(`payment-record-${WORKER_TUAN.id}`),
    ).toBeTruthy();
    // The JWT-wide list still carries manage_invoices, so the button is only hidden once the
    // project row (with the D8 deny) has answered — a screen reading the JWT list would keep it.
    await waitFor(() =>
      expect(screen.queryByTestId("payment-record-all")).toBeNull(),
    );
  });
});

// A member's own attendance lives on the first worker-mode tab (the Labor slot shows their
// profile), so the worker view is rendered directly rather than through LaborTab.
describe("labor tab · member (worker mode)", () => {
  beforeEach(() => {
    mockPersona = persona("member");
  });

  it("shows only the worker's own view: pending day, KPIs, roster without pay", async () => {
    await renderWithProviders(<WorkerAttendanceTab />);

    expect(await screen.findByTestId("worker-attendance-title")).toBeTruthy();
    expect(screen.queryByTestId("labor-title")).toBeNull();
    expect(screen.queryByTestId("day-log")).toBeNull();
    expect(screen.queryByTestId("worker-add")).toBeNull();

    // Today was self-logged and waits for a manager: badge + edit, no second submit.
    expect(
      await screen.findByTestId("worker-selected-status"),
    ).toHaveTextContent(containing("Pending"));
    expect(screen.getByTestId("worker-edit-open")).toBeTruthy();
    expect(screen.queryByTestId("worker-log-submit")).toBeNull();
    expect(screen.getByTestId("worker-kpi-pending")).toHaveTextContent(
      containing("1"),
    );
    expect(
      screen.getByTestId(`worker-entry-${ENTRY_MINH_PENDING.id}`),
    ).toBeTruthy();

    // Roster (D3): colleagues' names and presence, never a pay figure.
    expect(await screen.findByText("Tuan Worker")).toBeTruthy();
    expect(screen.queryByTestId(`roster-pay-${WORKER_TUAN.id}`)).toBeNull();
    expect(screen.queryByTestId(`roster-pay-${WORKER_MINH.id}`)).toBeNull();
  });

  it("self-logs today and refreshes the month so the new day shows up", async () => {
    // Nothing logged today yet.
    mockEntries = ENTRIES.filter((row) => row.id !== ENTRY_MINH_PENDING.id);
    mockPost.mockImplementation(async () => ({
      data: { ...ENTRY_MINH_PENDING },
      response: { status: 201, statusText: "Created" },
    }));
    await renderWithProviders(<WorkerAttendanceTab />);

    const submit = await screen.findByTestId("worker-log-submit");
    const entriesCallsBefore = callsTo(
      mockGet,
      "/api/v1/projects/{project_id}/labor-entries",
    ).length;
    const rosterCallsBefore = callsTo(
      mockGet,
      "/api/v1/projects/{project_id}/labor/roster",
    ).length;
    await fireEvent.press(submit);

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        "/api/v1/projects/{project_id}/labor-entries/self",
        expect.objectContaining({
          body: expect.objectContaining({ date: TODAY, shift_type: "full" }),
        }),
      ),
    );
    // The mutation invalidates the month and the day roster, so both are fetched again
    // (the roster shows the new day as pending without waiting for a refocus).
    await waitFor(() =>
      expect(
        callsTo(mockGet, "/api/v1/projects/{project_id}/labor-entries").length,
      ).toBeGreaterThan(entriesCallsBefore),
    );
    await waitFor(() =>
      expect(
        callsTo(mockGet, "/api/v1/projects/{project_id}/labor/roster").length,
      ).toBeGreaterThan(rosterCallsBefore),
    );
  });

  it("refetches the roster when the tab regains focus (a manager's validation shows up)", async () => {
    await renderWithProviders(<WorkerAttendanceTab />);
    await screen.findByText("Tuan Worker");
    const rosterCallsBefore = callsTo(
      mockGet,
      "/api/v1/projects/{project_id}/labor/roster",
    ).length;

    // useRefetchOnFocus skips the very first focus (mount) and refetches on the next one.
    await act(async () => {
      for (const callback of mockFocusCallbacks) callback();
    });
    await act(async () => {
      for (const callback of mockFocusCallbacks) callback();
    });

    await waitFor(() =>
      expect(
        callsTo(mockGet, "/api/v1/projects/{project_id}/labor/roster").length,
      ).toBeGreaterThan(rosterCallsBefore),
    );
  });

  it("tells a member without a linked worker to ask their manager", async () => {
    mockWorkers = [];
    mockEntries = [];
    await renderWithProviders(<WorkerAttendanceTab />);

    expect(await screen.findByTestId("worker-not-linked")).toBeTruthy();
    expect(screen.queryByTestId("worker-log-card")).toBeNull();
  });
});
