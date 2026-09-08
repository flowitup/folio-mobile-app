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
