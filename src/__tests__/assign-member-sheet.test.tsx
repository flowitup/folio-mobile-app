import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import "@/i18n";
import { AssignMemberSheet } from "@/features/projects/assign-member-sheet";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * `role: "manager"` raises the target's COMPANY role, which the backend allows to company
 * admins alone — so the picker is theirs only. Default persona: admin of the sheet's company.
 */
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

// See company-member-grants-sheet.test.tsx for why the pending GET is settled in afterEach
// instead of left as a genuinely never-resolving promise (Jest worker leak).
let pendingResolve: ((value: unknown) => void) | null = null;

async function renderSheet(companyId: string | null | undefined = "c1") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>
        <AssignMemberSheet projectId="p1" companyId={companyId} members={[]} />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe("AssignMemberSheet", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockCompanyRole = "admin";
  });

  afterEach(() => {
    pendingResolve?.({ data: { items: [] } });
    pendingResolve = null;
  });

  it("mounts the person picker, role picker and submit button before the directory query resolves", async () => {
    // Regression guard for the bug where the pickers only mounted once the directory query
    // resolved — that gap meant a slow directory fetch left the sheet showing nothing usable.
    mockGet.mockReturnValue(
      new Promise((resolve) => {
        pendingResolve = resolve;
      }),
    );

    await renderSheet();

    expect(screen.getByTestId("assign-member-person")).toBeTruthy();
    expect(screen.getByTestId("assign-member-role")).toBeTruthy();
    expect(screen.getByTestId("assign-member-submit")).toBeTruthy();
    expect(
      screen.getByTestId("assign-member-submit").props.accessibilityState
        .disabled,
    ).toBe(true);
  });

  it("shows an inline error with retry (not the empty state) when the directory query fails", async () => {
    mockGet.mockRejectedValue(new Error("network down"));

    await renderSheet();

    expect(await screen.findByTestId("error-state")).toBeTruthy();
    expect(screen.queryByTestId("empty-state")).toBeNull();
  });
});

describe("AssignMemberSheet · promotion gate", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ data: { items: [] } });
  });

  it("offers the role picker to a company admin", async () => {
    mockCompanyRole = "admin";
    await renderSheet();
    expect(screen.getByTestId("assign-member-role")).toBeTruthy();
  });

  it.each(["manager", "member"] as const)(
    "hides it from a company %s, who can only assign plain members",
    async (role) => {
      mockCompanyRole = role;
      await renderSheet();

      expect(screen.queryByTestId("assign-member-role")).toBeNull();
      // The person picker and submit stay — only the promotion is out of reach.
      expect(screen.getByTestId("assign-member-person")).toBeTruthy();
      expect(screen.getByTestId("assign-member-submit")).toBeTruthy();
    },
  );

  it("hides it when the sheet has no company to be admin of", async () => {
    mockCompanyRole = "admin";
    await renderSheet(null);
    expect(screen.queryByTestId("assign-member-role")).toBeNull();
  });
});
