import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import i18n from "@/i18n";
import ProjectSalariesSection from "../../app/(app)/(tabs)/projects/[id]/salaries";
import {
  MONTH,
  WORKER_MINH,
  answerGet,
  callsTo,
  containing,
  ok,
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

const mockShowToast = jest.fn();
jest.mock("@/components/ui/toast", () => ({
  ...jest.requireActual("@/components/ui/toast"),
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

const INVOICES_PATH = "/api/v1/projects/{project_id}/invoices";

beforeEach(() => {
  mockShowToast.mockReset();
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

  it("files a payment made just after local midnight on the local day, not the UTC one", async () => {
    mockCurrent = persona("manager");
    mockPost.mockImplementation(async () => ok({}));
    await renderWithProviders(<ProjectSalariesSection />);
    await fireEvent.press(await screen.findByTestId(`salary-pay-${MONTH}`));
    await waitFor(() =>
      expect(screen.getByTestId("salary-amount").props.value).toBe("150"),
    );

    // A phone in Vietnam (UTC+7) at 06:30 on 1 Nov, whose UTC calendar day is still 31 Oct.
    // Only the local calendar fields are shifted; the instant stays the same.
    const RealDate = Date;
    const NOW = RealDate.parse("2026-10-31T23:30:00Z");
    const inHanoi = (date: Date) =>
      new RealDate(date.getTime() + 7 * 3_600_000);
    class HanoiDate extends RealDate {
      constructor(...args: unknown[]) {
        super(...((args.length ? args : [NOW]) as [number]));
      }
      static now() {
        return NOW;
      }
      getFullYear() {
        return inHanoi(this).getUTCFullYear();
      }
      getMonth() {
        return inHanoi(this).getUTCMonth();
      }
      getDate() {
        return inHanoi(this).getUTCDate();
      }
    }
    global.Date = HanoiDate as DateConstructor;
    try {
      await fireEvent.press(screen.getByTestId("salary-pay-submit"));
    } finally {
      global.Date = RealDate;
    }

    await waitFor(() =>
      expect(callsTo(mockPost, INVOICES_PATH)).toHaveLength(1),
    );
    expect(callsTo(mockPost, INVOICES_PATH)[0][1].body.issue_date).toBe(
      "2026-11-01",
    );
  });

  it("speaks of a payment, not an invoice, in one toast", async () => {
    mockCurrent = persona("manager");
    mockPost.mockImplementation(async () => ok({}));
    await renderWithProviders(<ProjectSalariesSection />);
    await fireEvent.press(await screen.findByTestId(`salary-pay-${MONTH}`));
    await waitFor(() =>
      expect(screen.getByTestId("salary-amount").props.value).toBe("150"),
    );
    await fireEvent.press(screen.getByTestId("salary-pay-submit"));

    await waitFor(() => expect(mockShowToast).toHaveBeenCalled());
    expect(mockShowToast.mock.calls).toEqual([
      [i18n.t("salaries.paidToast"), "success"],
    ]);
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
