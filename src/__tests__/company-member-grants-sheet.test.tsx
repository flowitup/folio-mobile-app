import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import "@/i18n";
import type { AttachedUser } from "@/features/companies/company-members-api";
import { MemberGrantsSheet } from "@/features/companies/member-grants-sheet";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const mockGet = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    PUT: (...args: unknown[]) => mockPut(...args),
    DELETE: (...args: unknown[]) => mockDelete(...args),
  },
}));

const MEMBER: AttachedUser = {
  user_id: "u1",
  email: "jean@example.com",
  display_name: "Jean Dupont",
  is_primary: false,
  attached_at: "2026-01-01T00:00:00Z",
  role: "member",
};

function grantsResponse(customisable: string[]) {
  return { data: { grants: [], customisable } };
}

async function renderSheet(
  companyId = "c1",
  member: AttachedUser | null = MEMBER,
) {
  // `gcTime: 0` avoids react-query scheduling a real (non-fake) garbage-collection timer per
  // query, which otherwise keeps the never-resolving-GET test's Jest worker alive past the run.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>
        <MemberGrantsSheet companyId={companyId} member={member} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe("MemberGrantsSheet", () => {
  // The first test needs a GET that stays pending for the assertions below, but an actually
  // never-resolving promise leaks its Jest worker at teardown. Capture the resolver instead and
  // settle it in `afterEach` so nothing is left hanging once the test has made its point.
  let pendingResolve: ((value: unknown) => void) | null = null;

  beforeEach(() => {
    mockGet.mockReset();
    mockPut.mockReset();
    mockDelete.mockReset();
  });

  afterEach(() => {
    pendingResolve?.({ data: { grants: [], customisable: [] } });
    pendingResolve = null;
  });

  it("mounts the permission and scope pickers immediately, before the grants query resolves", async () => {
    // The grants + projects GETs stay pending for the duration of this test — regression guard
    // for the bug where the pickers only mounted (as nested bottom sheets) after their data
    // arrived, which corrupted the parent sheet's stack once the user was already looking at it.
    mockGet.mockReturnValue(
      new Promise((resolve) => {
        pendingResolve = resolve;
      }),
    );

    await renderSheet();

    expect(screen.getByTestId("grant-permission")).toBeTruthy();
    expect(screen.getByTestId("grant-scope")).toBeTruthy();
    expect(
      screen.getByTestId("grant-submit").props.accessibilityState.disabled,
    ).toBe(true);
  });

  // `jest.setup.ts` mocks `@gorhom/bottom-sheet` with `@gorhom/bottom-sheet/mock`, a plain inline
  // view, not the real stacked-sheet implementation — so this test (and the scope one below it)
  // cannot actually reproduce the gorhom push-stack corruption bug it is guarding against; under
  // the mock, present()/dismiss() are no-ops on plain state and would pass even with the old,
  // broken conditional-mount code. The real regression guard is the structural mount test above
  // ("mounts the permission and scope pickers immediately, before the grants query resolves"),
  // which fails under the old code regardless of the mock. Kept here as a behavioral smoke test.
  it("selecting a permission keeps the grants sheet open and enables Save", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path.includes("/grants"))
        return Promise.resolve(
          grantsResponse(["project:view_pay", "bibliotheque:manage"]),
        );
      return Promise.resolve({ data: { projects: [], total: 0 } });
    });

    await renderSheet();

    await waitFor(() =>
      expect(
        screen.getByTestId("grant-permission-option-project:view_pay"),
      ).toBeTruthy(),
    );

    // Open the nested permission picker and pick an option.
    await fireEvent.press(screen.getByTestId("grant-permission"));
    await fireEvent.press(
      screen.getByTestId("grant-permission-option-project:view_pay"),
    );

    // The grants sheet (title, other fields) is still rendered — selecting an option in the
    // nested picker must not have dismissed it.
    expect(screen.getByTestId("grant-scope")).toBeTruthy();
    expect(screen.getByTestId("grant-submit")).toBeTruthy();
    expect(
      screen.getByTestId("grant-submit").props.accessibilityState.disabled,
    ).toBe(false);

    // The picker can be reopened and a different option chosen without getting stuck.
    await fireEvent.press(screen.getByTestId("grant-permission"));
    await fireEvent.press(
      screen.getByTestId("grant-permission-option-bibliotheque:manage"),
    );
    expect(
      screen.getByTestId("grant-submit").props.accessibilityState.disabled,
    ).toBe(false);
  });

  // Same caveat as above: the mock cannot reproduce the real gorhom stack bug; this is a
  // behavioral smoke test, not the regression guard (see the structural mount test).
  it("selecting a scope keeps the sheet open and submits the chosen project", async () => {
    mockGet.mockImplementation((path: string) => {
      if (path.includes("/grants"))
        return Promise.resolve(grantsResponse(["project:view_pay"]));
      return Promise.resolve({
        data: {
          projects: [
            { id: "p1", name: "Chantier A", company_id: "c1" },
            { id: "p2", name: "Chantier B", company_id: "c1" },
          ],
          total: 2,
        },
      });
    });
    mockPut.mockResolvedValue({
      data: {
        permission: "project:view_pay",
        effect: "grant",
        project_id: "p1",
      },
    });

    await renderSheet();

    await waitFor(() =>
      expect(
        screen.getByTestId("grant-permission-option-project:view_pay"),
      ).toBeTruthy(),
    );
    await fireEvent.press(screen.getByTestId("grant-permission"));
    await fireEvent.press(
      screen.getByTestId("grant-permission-option-project:view_pay"),
    );

    await waitFor(() =>
      expect(screen.getByTestId("grant-scope-option-p1")).toBeTruthy(),
    );
    await fireEvent.press(screen.getByTestId("grant-scope"));
    await fireEvent.press(screen.getByTestId("grant-scope-option-p1"));

    await fireEvent.press(screen.getByTestId("grant-submit"));

    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
    const [, options] = mockPut.mock.calls[0] as [string, { body: unknown }];
    expect(options.body).toMatchObject({
      permission: "project:view_pay",
      effect: "grant",
      project_id: "p1",
    });
  });
});
