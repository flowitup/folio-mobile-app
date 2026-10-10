import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";

import i18n from "@/i18n";
import LaborTab from "../../app/(app)/(tabs)/labor";
import { WorkerAttendanceTab } from "@/features/labor/worker-attendance-tab";
import type { LaborEntry, Worker } from "@/features/labor/labor-types";
import { formatDate } from "@/lib/format/date";
import { formatMoney, formatNumber } from "@/lib/format/money";
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

  it("opens on the Summary: all-history totals, paid, and a month worker by worker", async () => {
    await renderWithProviders(<LaborTab />);

    expect(await screen.findByTestId("labor-overview")).toBeTruthy();
    expect(await screen.findByTestId("labor-overview-total")).toHaveTextContent(
      containing(formatMoney(330)),
    );
    expect(screen.getByTestId("labor-overview-days")).toHaveTextContent(
      formatNumber(2.5),
    );
    // The Summary has its own period; the attendance month stepper is hidden.
    expect(screen.queryByTestId("labor-month")).toBeNull();
    // Paid this month = every payment, assigned (100) or not (80).
    const monthKey = `${TODAY.slice(0, 7)}`;
    expect(screen.getByTestId(`overview-month-${monthKey}`)).toHaveTextContent(
      containing(formatMoney(180)),
    );

    await fireEvent.press(
      screen.getByTestId(`overview-month-open-${monthKey}`),
    );
    // Tuan: 180 owed − 100 paid; Minh: nothing paid yet.
    expect(
      await screen.findByTestId(`overview-balance-${WORKER_TUAN.id}`),
    ).toHaveTextContent(containing(formatMoney(80)));
    expect(
      screen.getByTestId(`overview-balance-${WORKER_MINH.id}`),
    ).toHaveTextContent(containing(formatMoney(150)));
    // Balance ignores the unassigned payment: 330 − 100.
    expect(
      screen.getByTestId("labor-overview-month-balance"),
    ).toHaveTextContent(containing(formatMoney(230)));
  });

  it("shows the month KPIs, the calendar day card and the log button", async () => {
    await renderWithProviders(<LaborTab />);

    expect(await screen.findByTestId("labor-title")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("labor-tab-calendar"));
    // Locale decimals, as on every other figure ("2,5" in vi / fr).
    expect(await screen.findByTestId("labor-kpi-days")).toHaveTextContent(
      formatNumber(2.5),
      { exact: true },
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

describe("labor tab · pay visible but project:manage_labor denied (D8)", () => {
  // The backend answers 403 to every labor write without manage_labor, so the
  // screen offers none: the roster, the entries and the day details are read-only.
  beforeEach(() => {
    mockPersona = persona("manager", { deny: ["project:manage_labor"] });
  });

  it("does not open the worker actions from a worker card", async () => {
    mockParams = { segment: "workers" };
    await renderWithProviders(<LaborTab />);

    await fireEvent.press(
      await screen.findByTestId(`worker-card-${WORKER_MINH.id}`),
    );
    expect(screen.queryByTestId(`worker-edit-${WORKER_MINH.id}`)).toBeNull();
    expect(screen.queryByTestId(`worker-rates-${WORKER_MINH.id}`)).toBeNull();
    expect(screen.queryByTestId(`worker-delete-${WORKER_MINH.id}`)).toBeNull();
    expect(screen.queryByTestId("worker-add")).toBeNull();
  });

  it("does not open the entry editor from the list view", async () => {
    mockParams = { segment: "calendar" };
    const [first] = ENTRIES;
    await renderWithProviders(<LaborTab />);

    await fireEvent.press(await screen.findByTestId("attendance-view-list"));
    await fireEvent.press(await screen.findByTestId(`list-entry-${first.id}`));
    expect(
      screen.queryByText(`${first.worker_name} · ${formatDate(first.date)}`),
    ).toBeNull();
  });

  it("shows the day details without the activity and description controls", async () => {
    mockParams = { segment: "calendar" };
    await renderWithProviders(<LaborTab />);

    expect(await screen.findByTestId("day-description-text")).toBeTruthy();
    expect(screen.queryByTestId("activity-add")).toBeNull();
    expect(screen.queryByTestId("activity-title")).toBeNull();
    expect(screen.queryByTestId("day-description-save")).toBeNull();
  });
});

describe("labor tab · export without a full project view", () => {
  // Neither manage_labor nor view_pay: the backend refuses the project-wide export.
  beforeEach(() => {
    mockPersona = persona("manager", {
      deny: ["project:manage_labor", "project:view_pay"],
    });
  });

  it("offers only the caller's own worker, never the whole project", async () => {
    mockWorkers = [WORKER_TUAN];
    await renderWithProviders(<LaborTab />);

    // No pay visibility: no Summary segment, the tab opens on attendance.
    expect(await screen.findByTestId("labor-tab-calendar")).toBeTruthy();
    expect(screen.queryByTestId("labor-tab-overview")).toBeNull();

    expect(await screen.findByTestId("labor-export")).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.queryByTestId("labor-export-worker-option-__all__"),
      ).toBeNull(),
    );
    expect(
      screen.getByTestId(`labor-export-worker-option-${WORKER_TUAN.id}`),
    ).toBeTruthy();
    expect(screen.getByTestId("labor-export-worker")).toHaveTextContent(
      containing(WORKER_TUAN.name),
    );
  });

  it("hides the export when no worker is linked to the caller", async () => {
    mockWorkers = [];
    await renderWithProviders(<LaborTab />);

    expect(await screen.findByTestId("labor-title")).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByTestId("labor-export")).toBeNull(),
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
    ).toHaveTextContent(containing(i18n.t("worker.status.pending")));
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

  it("never falls back to a colleague's row when none is linked to the account", async () => {
    // What a member granted `project:view_pay` receives: every worker, none of them theirs.
    mockWorkers = [{ ...WORKER_TUAN, user_id: "u-other" }];
    mockEntries = [];
    await renderWithProviders(<WorkerAttendanceTab />);

    expect(await screen.findByTestId("worker-not-linked")).toBeTruthy();
    expect(screen.queryByTestId("worker-log-card")).toBeNull();
    expect(screen.queryByTestId("worker-log-submit")).toBeNull();
  });
});
