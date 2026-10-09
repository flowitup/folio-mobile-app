import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { LaborOverview } from "@/features/labor/labor-overview";
import i18n, { DEFAULT_LOCALE } from "@/i18n";
import {
  LABOR_MONTHLY,
  WORKERS,
  ok,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";

/**
 * When the monthly ledger failed to load, the overview showed 0 € everywhere and
 * "No entries found", which reads as "no labor cost". It now shows an error with Retry.
 */
const mockGet = jest.fn();
jest.mock("@/api/client", () => ({
  api: { GET: (...args: unknown[]) => mockGet(...args) },
}));

jest.mock("@/lib/query/use-refetch-on-focus", () => ({
  useRefetchOnFocus: () => undefined,
}));

const MONTHLY_PATH = "/api/v1/projects/{project_id}/labor-monthly-summary";
let monthlyFails = true;

beforeAll(async () => {
  await i18n.changeLanguage("en");
});
afterAll(async () => {
  await i18n.changeLanguage(DEFAULT_LOCALE);
});

beforeEach(() => {
  monthlyFails = true;
  mockGet.mockReset();
  mockGet.mockImplementation(async (path: string) => {
    if (path === MONTHLY_PATH)
      return monthlyFails
        ? {
            error: { error: "InternalError", message: "boom" },
            response: { status: 500, statusText: "Internal Server Error" },
          }
        : ok(LABOR_MONTHLY);
    return ok({ rows: [] });
  });
});

describe("labor overview", () => {
  it("shows an error with Retry instead of a zero-cost overview", async () => {
    await renderWithProviders(
      <LaborOverview
        projectId="p1"
        workers={WORKERS}
        payments={undefined}
        colorOf={() => "#000"}
        roleOf={() => null}
      />,
    );
    await waitFor(() => expect(screen.getByTestId("error-state")).toBeTruthy());
    expect(screen.queryByTestId("labor-overview")).toBeNull();
    expect(screen.getByText("Could not load this content.")).toBeTruthy();

    monthlyFails = false;
    await fireEvent.press(screen.getByText("Retry"));
    await waitFor(() =>
      expect(screen.getByTestId("labor-overview")).toBeTruthy(),
    );
  });
});
