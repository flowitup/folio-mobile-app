import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import i18n from "@/i18n";
import { WorkerFormSheet } from "@/features/labor/labor-sheets";

// Renders are kept to one per test and few per file on purpose: this suite's screens
// pollute each other once a file accumulates them, and the later tests then never see
// their own options render. Gating cases live in worker-form-directory-gating.test.tsx.

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const PERSONS_PATH = "/api/v1/companies/{company_id}/persons";
const WORKERS_PATH = "/api/v1/projects/{project_id}/workers";

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      email: "qa@example.com",
      permissions: [],
      companies: [{ id: "c1", legal_name: "Folio QA", role: "admin" }],
      is_platform_ops: false,
    },
  }),
}));

const mockGet = jest.fn();
jest.mock("@/api/client", () => ({
  api: { GET: (...args: unknown[]) => mockGet(...args) },
}));

function directoryPerson(over: Record<string, unknown> = {}) {
  return {
    person_id: "person-1",
    name: "Alice Durand",
    phone: "+33600000001",
    linked_user_id: null,
    assigned_project_ids: [],
    is_active: true,
    pending: false,
    labor_role_id: null,
    default_daily_rate: 145,
    ...over,
  };
}

const onSubmit = jest.fn();

async function renderSheet() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  // RNTL 14 renders asynchronously: without the await, `screen` is still empty when the
  // first assertion runs and every query fails on an element that does exist.
  return await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>
        <WorkerFormSheet
          projectId="proj-1"
          companyId="c1"
          submitting={false}
          onSubmit={onSubmit}
        />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

const t = (key: string) => i18n.t(key);

describe("WorkerFormSheet — company directory", () => {
  beforeEach(() => {
    mockGet.mockReset();
    onSubmit.mockReset();
    mockGet.mockImplementation((path: string) => {
      if (path === PERSONS_PATH)
        return Promise.resolve({
          data: {
            items: [
              directoryPerson(),
              directoryPerson({
                person_id: "person-2",
                name: "Bruno Sans-Tarif",
                phone: null,
                default_daily_rate: null,
              }),
            ],
          },
        });
      if (path === WORKERS_PATH)
        return Promise.resolve({ data: { workers: [], total: 0 } });
      return Promise.resolve({ data: {} });
    });
  });

  it("links the worker by person_id, prefilling pay but sending no name", async () => {
    await renderSheet();
    await waitFor(
      () =>
        expect(
          screen.getByTestId("worker-person-option-person-1"),
        ).toBeTruthy(),
      { timeout: 5000 },
    );

    await fireEvent.press(screen.getByTestId("worker-person"));
    await fireEvent.press(screen.getByTestId("worker-person-option-person-1"));

    // Identity now comes from the Person: the free-text fields give way to their profile.
    expect(screen.getByTestId("worker-person-name").props.children).toBe(
      "Alice Durand",
    );
    expect(screen.queryByTestId("worker-name")).toBeNull();
    expect(screen.queryByTestId("worker-phone")).toBeNull();
    expect(screen.getByTestId("worker-rate").props.value).toBe("145");

    // Re-picking someone the company has no rate for clears the pay field, and the form
    // refuses to submit until one is typed — the server cannot resolve it either.
    await fireEvent.press(screen.getByTestId("worker-person"));
    await fireEvent.press(screen.getByTestId("worker-person-option-person-2"));
    expect(screen.getByTestId("worker-rate").props.value).toBe("");
    await fireEvent.press(screen.getByTestId("worker-submit"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(t("labor.workers.rateRequired"))).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId("worker-rate"), "132");
    await fireEvent.press(screen.getByTestId("worker-submit"));

    expect(onSubmit).toHaveBeenCalledWith({
      person_id: "person-2",
      daily_rate: 132,
      role_id: undefined,
      user_id: undefined,
    });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("name");
  });

  it("keeps the manual path for someone the company does not know yet", async () => {
    await renderSheet();
    await waitFor(() =>
      expect(screen.getByTestId("worker-person")).toBeTruthy(),
    );

    await fireEvent.changeText(screen.getByTestId("worker-name"), "Bob Neuf");
    await fireEvent.changeText(screen.getByTestId("worker-rate"), "130");
    await fireEvent.press(screen.getByTestId("worker-submit"));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Bob Neuf",
      phone: undefined,
      daily_rate: 130,
      role_id: undefined,
      user_id: undefined,
    });
  });

  it("does not offer someone who already works on this project", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === PERSONS_PATH)
        return Promise.resolve({
          data: {
            items: [
              directoryPerson(),
              directoryPerson({ person_id: "person-2", name: "Free Agent" }),
            ],
          },
        });
      if (path === WORKERS_PATH)
        return Promise.resolve({
          data: {
            workers: [
              {
                id: "w-1",
                project_id: "proj-1",
                name: "Alice Durand",
                phone: null,
                daily_rate: 145,
                is_active: true,
                created_at: "2026-09-01T08:00:00Z",
                person_id: "person-1",
              },
            ],
            total: 1,
          },
        });
      return Promise.resolve({ data: {} });
    });

    await renderSheet();

    // Wait on the free person's option, not on the picker: the picker mounts before the
    // directory answers, so asserting the taken person's absence any earlier would pass
    // without the filter ever having run.
    await waitFor(
      () =>
        expect(
          screen.getByTestId("worker-person-option-person-2"),
        ).toBeTruthy(),
      { timeout: 5000 },
    );
    expect(screen.queryByTestId("worker-person-option-person-1")).toBeNull();
  });
});
