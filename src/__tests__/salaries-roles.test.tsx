import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import i18n from "@/i18n";
import ProjectSalariesSection from "../../app/(app)/(tabs)/projects/[id]/salaries";
import {
  MONTH,
  WORKER_MINH,
  answerGet,
  callsTo,
  containing,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";
import type { Persona } from "./helpers/release-qa-fixtures";

/**
 * Salaries per company role. Reading a worker's months needs nothing beyond `project:read`;
 * recording or removing a payment is `project:manage_invoices`, so a member gets the same
 * figures with the read-only note and no pay controls. The month rows come from the monthly
 * summary crossed with that worker's labor invoices — Minh earned 150 this month and was
 * never paid, Tuan carries the only payment.
 */
let mockCurrent: Persona = persona("manager");

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: "p1" }),
  useFocusEffect: () => undefined,
}));

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: mockCurrent.user }),
}));

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

const INVOICES_PATH = "/api/v1/projects/{project_id}/invoices";

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockDelete.mockReset();
  mockGet.mockImplementation(answerGet(() => mockCurrent));
});

describe("Salaries per role", () => {
  it("lets a manager mark the month paid from a prefilled sheet", async () => {
    mockCurrent = persona("manager");
    await renderWithProviders(<ProjectSalariesSection />);

    await waitFor(() =>
      expect(screen.getByTestId("salaries-outstanding")).toBeTruthy(),
    );
    // Minh: 150 earned this month, nothing paid.
    expect(screen.getByTestId("salaries-outstanding")).toHaveTextContent(
      containing("150"),
    );
    expect(screen.queryByText(i18n.t("salaries.readOnly"))).toBeNull();

    const pay = screen.getByTestId(`salary-pay-${MONTH}`);
    await fireEvent.press(pay);

    await waitFor(() =>
      expect(screen.getByTestId("salary-amount").props.value).toBe("150"),
    );
  });

  it("shows a member the same months read-only", async () => {
    mockCurrent = persona("member");
    await renderWithProviders(<ProjectSalariesSection />);

    await waitFor(() =>
      expect(screen.getByTestId("salaries-outstanding")).toBeTruthy(),
    );
    expect(screen.getByTestId("salaries-outstanding")).toHaveTextContent(
      containing("150"),
    );
    expect(screen.getByTestId(`salary-month-${MONTH}`)).toBeTruthy();
    expect(screen.getByText(i18n.t("salaries.readOnly"))).toBeTruthy();
    expect(screen.queryByTestId(`salary-pay-${MONTH}`)).toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("narrows the ledger to that worker's labor payments for every role", async () => {
    for (const role of ["manager", "member"] as const) {
      mockGet.mockClear();
      mockCurrent = persona(role);
      await renderWithProviders(<ProjectSalariesSection />);

      await waitFor(() =>
        expect(callsTo(mockGet, INVOICES_PATH).length).toBeGreaterThan(0),
      );
      const queries = callsTo(mockGet, INVOICES_PATH).map(
        (call) => call[1]?.params?.query ?? {},
      );
      for (const query of queries) expect(query.type).toBe("labor");
      await waitFor(() =>
        expect(
          callsTo(mockGet, INVOICES_PATH).some(
            (call) => call[1]?.params?.query?.worker_id === WORKER_MINH.id,
          ),
        ).toBe(true),
      );
    }
  });

  it("hides the pay controls from a manager denied manage_invoices on this project", async () => {
    mockCurrent = persona("manager", { deny: ["project:manage_invoices"] });
    await renderWithProviders(<ProjectSalariesSection />);

    // Anchor on the month row: "no pay button" would pass vacuously on an empty month list.
    await waitFor(() =>
      expect(screen.getByTestId(`salary-month-${MONTH}`)).toBeTruthy(),
    );
    await waitFor(() =>
      expect(screen.queryByTestId(`salary-pay-${MONTH}`)).toBeNull(),
    );
    expect(screen.getByText(i18n.t("salaries.readOnly"))).toBeTruthy();
  });
});
