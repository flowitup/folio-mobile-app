import type { QueryClient } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import "@/i18n";
import OverviewTab from "../../app/(app)/(tabs)/index";
import { companyKeys } from "@/features/companies/companies-api";
import { formatMoney } from "@/lib/format/money";
import {
  PROJECT_ID,
  TODAY,
  answerGet,
  callsTo,
  containing,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";
import type { Persona } from "./helpers/release-qa-fixtures";

/**
 * Overview tab per company role. A manager and an admin get the ink hero with the money
 * figures and quick actions; a member (no `project:manage_labor`) gets their own attendance
 * view instead and the app never even asks for the invoice ledger on their behalf.
 */
let mockPersona: Persona = persona("manager");
const mockRouter = {
  push: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: () => true,
};

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => undefined,
}));

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: mockPersona.user }),
}));

// Open-Meteo is reached with the global `fetch`; the strip is not what these tests assert on.
jest.mock("@/features/dashboard/weather-api", () => ({
  useSiteWeather: () => ({ data: null, isPending: false, isError: false }),
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
  mockGet.mockImplementation(answerGet(() => mockPersona));
});

/** The refund tile's destination depends on `useBillingAccess`, i.e. on the companies query. */
async function companiesLoaded(queryClient: QueryClient) {
  await waitFor(() =>
    expect(queryClient.getQueryState(companyKeys.mine)?.status).toBe("success"),
  );
}

describe("overview tab · manager", () => {
  beforeEach(() => {
    mockPersona = persona("manager");
  });

  it("renders the ink hero, the due tiles, the agenda and today on site", async () => {
    await renderWithProviders(<OverviewTab />);

    expect(await screen.findByTestId("overview-headline")).toBeTruthy();
    expect(screen.getByTestId("overview-remaining")).toBeTruthy();
    expect(screen.getByTestId("overview-ring-pct")).toBeTruthy();
    // Bank credit still to draw: budget 60 000 − 20 000 released.
    expect(screen.getByTestId("overview-figure-bank")).toHaveTextContent(
      containing(formatMoney(40000)),
    );
    expect(await screen.findByTestId("overview-due-tiles")).toBeTruthy();
    expect(
      screen.getByTestId("overview-labor-unpaid-amount"),
    ).toHaveTextContent(containing(formatMoney(230)));
    expect(screen.getByTestId("overview-agenda")).toBeTruthy();
    expect(screen.getByText("Livraison carrelage")).toBeTruthy();
    expect(screen.getByTestId("overview-today-on-site")).toBeTruthy();
    expect(screen.queryByTestId("worker-attendance-title")).toBeNull();
  });

  it("quick actions open the invoice form, the released-funds preset and the payments segment", async () => {
    await renderWithProviders(<OverviewTab />);
    await screen.findByTestId("overview-headline");

    await fireEvent.press(screen.getByTestId("overview-add-invoice"));
    expect(mockRouter.push).toHaveBeenCalledWith(
      `/projects/${PROJECT_ID}/invoices/new`,
    );

    await fireEvent.press(screen.getByTestId("overview-add-release"));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: `/projects/${PROJECT_ID}/invoices/new`,
      params: { type: "released_funds" },
    });

    await fireEvent.press(screen.getByTestId("overview-pay-labor"));
    expect(mockRouter.navigate).toHaveBeenCalledWith({
      pathname: "/(app)/(tabs)/labor",
      params: { segment: "payments" },
    });
  });

  it("sends a manager (not a company admin) to the expenses tab for pending refunds", async () => {
    const { queryClient } = await renderWithProviders(<OverviewTab />);
    await screen.findByTestId("overview-due-tiles");
    await companiesLoaded(queryClient);

    await fireEvent.press(screen.getByTestId("overview-pending-refunds"));
    expect(mockRouter.navigate).toHaveBeenCalledWith("/(app)/(tabs)/expenses");
    expect(mockRouter.push).not.toHaveBeenCalledWith("/billing/refundable");
  });
});

describe("overview tab · admin", () => {
  beforeEach(() => {
    mockPersona = persona("admin");
  });

  it("opens the company billing refund list for pending refunds", async () => {
    const { queryClient } = await renderWithProviders(<OverviewTab />);
    await screen.findByTestId("overview-due-tiles");
    await companiesLoaded(queryClient);

    await fireEvent.press(screen.getByTestId("overview-pending-refunds"));
    expect(mockRouter.push).toHaveBeenCalledWith("/billing/refundable");
    expect(mockRouter.navigate).not.toHaveBeenCalledWith(
      "/(app)/(tabs)/expenses",
    );
  });
});

describe("overview tab · member (worker mode)", () => {
  beforeEach(() => {
    mockPersona = persona("member");
  });

  it("replaces the overview with the worker's own attendance", async () => {
    await renderWithProviders(<OverviewTab />);

    expect(await screen.findByTestId("worker-attendance-title")).toBeTruthy();
    expect(await screen.findByTestId("worker-log-card")).toBeTruthy();
    expect(screen.queryByTestId("overview-headline")).toBeNull();
    expect(screen.queryByTestId("overview-due-tiles")).toBeNull();
    expect(screen.queryByTestId("overview-add-invoice")).toBeNull();
  });

  it("never requests the invoice ledger nor the priced single-day summary", async () => {
    await renderWithProviders(<OverviewTab />);
    await screen.findByTestId("worker-log-card");
    await waitFor(() =>
      expect(
        callsTo(mockGet, "/api/v1/projects/{project_id}/labor/roster"),
      ).toHaveLength(1),
    );

    expect(
      callsTo(mockGet, "/api/v1/projects/{project_id}/invoices"),
    ).toHaveLength(0);
    // The day-pay summary (`from === to`) is only fetched for a caller with project:view_pay.
    const dayPayCalls = callsTo(
      mockGet,
      "/api/v1/projects/{project_id}/labor-summary",
    ).filter((call) => {
      const query = (
        call[1] as { params?: { query?: { from?: string; to?: string } } }
      ).params?.query;
      return query?.from === TODAY && query?.to === TODAY;
    });
    expect(dayPayCalls).toHaveLength(0);
    // The roster still lists colleagues, without any pay figure (D3).
    expect(await screen.findByText("Tuan Worker")).toBeTruthy();
    expect(screen.queryByTestId("roster-pay-w-tuan")).toBeNull();
  });
});
