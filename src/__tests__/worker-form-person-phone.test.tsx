import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import { WorkerFormSheet } from "@/features/labor/labor-sheets";
import type { Worker } from "@/features/labor/labor-types";

// Editing a worker's phone changes the shared person's phone everywhere, so the form must
// start from that phone, not from the per-project copy that may predate it.

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

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

jest.mock("@/api/client", () => ({
  api: { GET: jest.fn(async () => ({ data: {} })) },
}));

const WORKER = {
  id: "w1",
  project_id: "proj-1",
  name: "Alice Durand",
  phone: "+33600000001",
  person_id: "person-1",
  person_name: "Alice Durand",
  person_phone: "+33699887766",
  daily_rate: 145,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
} as unknown as Worker;

describe("WorkerFormSheet — editing a worker", () => {
  it("pre-fills the person's phone, not the stale per-project copy", async () => {
    await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <QueryClientProvider
          client={
            new QueryClient({
              defaultOptions: { queries: { retry: false, gcTime: 0 } },
            })
          }
        >
          <WorkerFormSheet
            worker={WORKER}
            projectId="proj-1"
            companyId="c1"
            submitting={false}
            onSubmit={jest.fn()}
          />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    expect(screen.getByTestId("worker-phone").props.value).toBe("+33699887766");
  });
});
