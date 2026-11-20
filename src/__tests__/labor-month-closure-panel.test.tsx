import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { useState } from "react";
import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";

import { useLaborMonthClosures } from "@/features/labor/labor-api";
import type { LaborMonthClosure } from "@/features/labor/labor-types";
import {
  LaborMonthClosureContext,
  MonthClosedBadge,
  MonthClosurePanel,
  useClosedMonths,
  useMonthClosureGuard,
} from "@/features/labor/month-closure";
import i18n, { DEFAULT_LOCALE } from "@/i18n";
import { ok, renderWithProviders } from "./helpers/release-qa-fixtures";

/**
 * "Chốt tháng" (owner decision QĐ-10) on the mobile labor tab: close with a checklist, the
 * closed badge with who and when, reopen, the "changed after closing" warning, and the
 * "Month X is closed. Save anyway?" question every save into a closed month asks first.
 */
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: (...args: unknown[]) => mockPost(...args),
    DELETE: (...args: unknown[]) => mockDelete(...args),
  },
}));

const CLOSURES_PATH = "/api/v1/projects/{project_id}/labor-month-closures";
const ENTRIES_PATH = "/api/v1/projects/{project_id}/labor-entries";

const CLOSED: LaborMonthClosure = {
  project_id: "p1",
  month: "2026-10",
  closed_at: "2026-11-02T09:00:00Z",
  closed_by_user_id: "u-admin",
  closed_by_name: "Admin An",
  edited_after_close: 0,
  last_edited_at: null,
  last_edited_by_user_id: null,
  last_edited_by_name: null,
  edits: [],
};

const EDITED: LaborMonthClosure = {
  ...CLOSED,
  edited_after_close: 2,
  last_edited_at: "2026-11-20T14:15:00Z",
  last_edited_by_user_id: "u-bob",
  last_edited_by_name: "Bob Manager",
  edits: [
    {
      kind: "entry_created",
      edited_at: "2026-11-20T14:15:00Z",
      user_id: "u-bob",
      user_name: "Bob Manager",
      entry_id: "e1",
      worker_id: "w1",
      worker_name: "Jean Dupont",
      entry_date: "2026-10-15",
    },
    {
      kind: "payment_created",
      edited_at: "2026-11-19T10:00:00Z",
      user_id: "u-admin",
      user_name: "Admin An",
      entry_id: "i1",
      worker_id: "w1",
      worker_name: "Jean Dupont",
      entry_date: null,
    },
  ],
};

let closures: LaborMonthClosure[] = [];

/** The provider as the labor tab mounts it: closures from the API, the guard's dialog. */
function Provider({ children }: { children: ReactNode }) {
  const query = useLaborMonthClosures("p1", true);
  const guard = useMonthClosureGuard(query.data ?? []);
  return (
    <LaborMonthClosureContext.Provider value={guard.api}>
      {children}
      {guard.dialog}
    </LaborMonthClosureContext.Provider>
  );
}

function Panel({ canManage = true }: { canManage?: boolean }) {
  return (
    <Provider>
      <MonthClosurePanel
        projectId="p1"
        month="2026-10"
        canManage={canManage}
        owed={450}
        payments={{
          months: [
            {
              year: 2026,
              month: 10,
              unassigned_count: 1,
              workers: [],
              total_paid: 0,
              unassigned_paid: 0,
              company_paid: 0,
              personal_paid: 0,
            },
          ],
        }}
      />
      <MonthClosedBadge month="2026-10" />
    </Provider>
  );
}

beforeAll(async () => {
  await i18n.changeLanguage("en");
});
afterAll(async () => {
  await i18n.changeLanguage(DEFAULT_LOCALE);
});

beforeEach(() => {
  closures = [];
  mockGet.mockReset();
  mockPost.mockReset();
  mockDelete.mockReset();
  mockGet.mockImplementation(async (path: string) => {
    if (path === CLOSURES_PATH) return ok({ closures });
    if (path === ENTRIES_PATH)
      return ok({
        entries: [
          { id: "a", date: "2026-10-01", status: "pending" },
          { id: "b", date: "2026-10-02", status: "validated" },
          { id: "c", date: "2026-10-03", status: "pending" },
        ],
      });
    return ok({});
  });
});

describe("MonthClosurePanel", () => {
  it("lets a manager close the month after a checklist of what is still loose", async () => {
    await renderWithProviders(<Panel />);
    const button = await screen.findByTestId("labor-month-close");
    expect(screen.getByText("Close October 2026")).toBeTruthy();
    expect(screen.queryByTestId("labor-month-closed-badge")).toBeNull();

    await fireEvent.press(button);
    await waitFor(() =>
      expect(screen.getByText(/2 days waiting for validation/)).toBeTruthy(),
    );
    expect(
      screen.getByText(/1 labor payment with no worker or month/),
    ).toBeTruthy();
    expect(screen.getByText(/Still owed to workers: .*450/)).toBeTruthy();
    expect(
      mockGet.mock.calls.some(
        ([path, init]) =>
          path === ENTRIES_PATH &&
          (init as { params: { query: unknown } }).params.query !== undefined &&
          JSON.stringify(
            (init as { params: { query: unknown } }).params.query,
          ) === JSON.stringify({ from: "2026-10-01", to: "2026-10-31" }),
      ),
    ).toBe(true);

    mockPost.mockResolvedValue(ok(CLOSED));
    closures = [CLOSED];
    await fireEvent.press(screen.getByText("Close month"));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(CLOSURES_PATH, {
        params: { path: { project_id: "p1" } },
        body: { month: "2026-10" },
      }),
    );
    await screen.findByTestId("labor-month-closed");
    expect(screen.getByTestId("labor-month-closed-badge")).toBeTruthy();
  });

  it("shows nothing to a viewer who may not close an open month", async () => {
    await renderWithProviders(<Panel canManage={false} />);
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(screen.queryByTestId("labor-month-close")).toBeNull();
  });

  it("shows who closed the month and when, and reopens after asking", async () => {
    closures = [CLOSED];
    await renderWithProviders(<Panel />);
    const closed = await screen.findByTestId("labor-month-closed");
    expect(closed).toHaveTextContent(
      /October 2026 closed · by Admin An, on 2 Nov 2026/,
    );
    expect(screen.queryByTestId("labor-month-edited")).toBeNull();

    mockDelete.mockResolvedValue({
      data: undefined,
      response: { status: 204, statusText: "No Content" },
    });
    closures = [];
    await fireEvent.press(screen.getByTestId("labor-month-reopen"));
    expect(screen.getByText("Reopen October 2026?")).toBeTruthy();
    await fireEvent.press(screen.getAllByText("Reopen").at(-1)!);
    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith(`${CLOSURES_PATH}/{month}`, {
        params: { path: { project_id: "p1", month: "2026-10" } },
      }),
    );
    await screen.findByTestId("labor-month-close");
  });

  it("a viewer without manage_labor sees the closed month but no reopen", async () => {
    closures = [CLOSED];
    await renderWithProviders(<Panel canManage={false} />);
    await screen.findByTestId("labor-month-closed");
    expect(screen.queryByTestId("labor-month-reopen")).toBeNull();
  });

  it("warns when the month was changed after closing, naming the last person, with the list", async () => {
    closures = [EDITED];
    await renderWithProviders(<Panel />);
    const warning = await screen.findByTestId("labor-month-edited");
    expect(warning).toHaveTextContent(
      /Changed after closing: 2 times, last by Bob Manager at/,
    );
    expect(screen.queryByTestId("labor-month-edits")).toBeNull();

    await fireEvent.press(screen.getByTestId("labor-month-edits-toggle"));
    const list = screen.getByTestId("labor-month-edits");
    expect(list).toHaveTextContent(/Day added · Jean Dupont · 15 Oct 2026/);
    expect(list).toHaveTextContent(/Payment recorded · Jean Dupont/);
  });
});

/** A save button the way the sheets use the guard: ask, then save only on "yes". */
function SaveInto({ day }: { day: string }) {
  const { closures: closed, confirmWrite } = useClosedMonths();
  const [result, setResult] = useState("idle");
  return (
    <Pressable
      testID="save"
      onPress={async () =>
        setResult((await confirmWrite([day])) ? "saved" : "cancelled")
      }
    >
      <Text testID="closed-count">{closed.length}</Text>
      <Text testID="result">{result}</Text>
    </Pressable>
  );
}

describe("saving into a closed month", () => {
  beforeEach(() => {
    closures = [CLOSED];
  });

  async function renderSave(day: string) {
    await renderWithProviders(
      <Provider>
        <SaveInto day={day} />
      </Provider>,
    );
    // Let the closures land.
    await waitFor(() =>
      expect(screen.getByTestId("closed-count")).toHaveTextContent("1"),
    );
  }

  it("asks 'Month X is closed. Save anyway?' and saves once confirmed", async () => {
    await renderSave("2026-10-15");
    // Not awaited: the press resolves only once the question is answered.
    void fireEvent.press(screen.getByTestId("save"));
    expect(
      await screen.findByText("October 2026 is closed. Save anyway?"),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText("Save anyway"));
    await waitFor(() =>
      expect(screen.getByTestId("result")).toHaveTextContent("saved"),
    );
  });

  it("does not save when the user cancels", async () => {
    await renderSave("2026-10-15");
    // Not awaited: the press resolves only once the question is answered.
    void fireEvent.press(screen.getByTestId("save"));
    expect(
      await screen.findByText("October 2026 is closed. Save anyway?"),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() =>
      expect(screen.getByTestId("result")).toHaveTextContent("cancelled"),
    );
  });

  it("saves without asking when the month is open", async () => {
    await renderSave("2026-11-03");
    await fireEvent.press(screen.getByTestId("save"));
    await waitFor(() =>
      expect(screen.getByTestId("result")).toHaveTextContent("saved"),
    );
    expect(screen.queryByText(/is closed. Save anyway/)).toBeNull();
  });
});
