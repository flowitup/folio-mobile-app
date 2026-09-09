import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import i18n from "@/i18n";
import ExpensesTab from "../../app/(app)/(tabs)/expenses";
import ProjectSalariesSection from "../../app/(app)/(tabs)/projects/[id]/salaries";
import InvoiceDetailScreen from "../../app/(app)/(tabs)/projects/[id]/invoices/[invoiceId]/index";
import NewInvoiceScreen from "../../app/(app)/(tabs)/projects/[id]/invoices/new";
import {
  INVOICE_MATERIALS,
  INVOICE_RELEASE,
  MONTH,
  PROJECT_ID,
  WORKER_MINH,
  answerGet,
  callsTo,
  containing,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";
import type { Persona } from "./helpers/release-qa-fixtures";

/**
 * Invoices per company role: the expenses ledger, the new-invoice form and the detail screen
 * for a manager (full write), the salary view for a member (read-only, own labor invoices
 * only), and the salaries section that toggles a month paid only with `project:manage_invoices`.
 */
let mockPersona: Persona = persona("manager");
let mockParams: { id?: string; invoiceId?: string; type?: string } = {};
const mockRouter = {
  push: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: () => true,
};

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: () => undefined,
}));

// Native pickers / share sheets are not what these tests assert on.
jest.mock("@react-native-community/datetimepicker", () => "DateTimePicker");
jest.mock("expo-print", () => ({ printToFileAsync: jest.fn() }));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => false),
  shareAsync: jest.fn(),
}));
jest.mock("@/lib/files/pick", () => ({
  captureImage: jest.fn(),
  pickDocuments: jest.fn(),
  pickImages: jest.fn(),
}));

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: mockPersona.user }),
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
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockPatch = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: (...args: unknown[]) => mockPost(...args),
    PUT: (...args: unknown[]) => mockPut(...args),
    PATCH: (...args: unknown[]) => mockPatch(...args),
    DELETE: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Implementations installed by one describe must not leak into the next.
  mockPost.mockReset();
  mockPut.mockReset();
  mockPatch.mockReset();
  mockParams = { id: PROJECT_ID };
  mockGet.mockImplementation(answerGet(() => mockPersona));
});

describe("expenses tab · manager", () => {
  beforeEach(() => {
    mockPersona = persona("manager");
  });

  it("lists the month's invoices, the purses and the create button", async () => {
    await renderWithProviders(<ExpensesTab />);

    expect(await screen.findByTestId("expenses-title")).toBeTruthy();
    expect(
      await screen.findByTestId(`invoice-row-${INVOICE_MATERIALS.id}`),
    ).toBeTruthy();
    expect(
      screen.getByTestId(`invoice-row-${INVOICE_RELEASE.id}`),
    ).toBeTruthy();
    expect(screen.getByTestId("expenses-purse-company")).toBeTruthy();
    expect(screen.getByTestId("expenses-purse-personal")).toBeTruthy();
    expect(screen.getByTestId("invoices-export")).toBeTruthy();
    expect(screen.queryByTestId("worker-salary-title")).toBeNull();

    await fireEvent.press(screen.getByTestId("invoices-create"));
    expect(mockRouter.push).toHaveBeenCalledWith(
      `/projects/${PROJECT_ID}/invoices/new`,
    );
  });
});

describe("expenses tab · member (worker mode)", () => {
  beforeEach(() => {
    mockPersona = persona("member");
  });

  it("shows the read-only salary view and asks only for the worker's labor invoices", async () => {
    await renderWithProviders(<ExpensesTab />);

    expect(await screen.findByTestId("worker-salary-title")).toBeTruthy();
    expect(await screen.findByTestId("salaries-outstanding")).toBeTruthy();
    expect(screen.getByText(i18n.t("salaries.readOnly"))).toBeTruthy();
    expect(screen.queryByTestId("invoices-create")).toBeNull();
    expect(screen.queryByTestId("invoices-export")).toBeNull();
    expect(screen.queryByTestId(`salary-pay-${MONTH}`)).toBeNull();
    expect(screen.queryByTestId(`salary-unpay-${MONTH}`)).toBeNull();

    // Never the whole ledger: every invoices request carries the labor filter (the first one
    // fires before the worker list answers, the next one names the worker).
    const queries = callsTo(
      mockGet,
      "/api/v1/projects/{project_id}/invoices",
    ).map(
      (call) =>
        (
          call[1] as {
            params: { query: { type?: string; worker_id?: string } };
          }
        ).params.query,
    );
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every((query) => query.type === "labor")).toBe(true);
    expect(queries.some((query) => query.worker_id === WORKER_MINH.id)).toBe(
      true,
    );
  });
});

describe("salaries section · manager", () => {
  beforeEach(() => {
    mockPersona = persona("manager");
  });

  it("lets a manager mark the month paid", async () => {
    await renderWithProviders(
      <ProjectSalariesSection projectId={PROJECT_ID} />,
    );

    // Minh (first worker) earned 150 this month and has no payment → unpaid.
    expect(await screen.findByTestId(`salary-month-${MONTH}`)).toBeTruthy();
    expect(await screen.findByTestId(`salary-pay-${MONTH}`)).toBeTruthy();
    expect(screen.queryByText(i18n.t("salaries.readOnly"))).toBeNull();
  });
});

describe("new invoice · manager", () => {
  beforeEach(() => {
    mockPersona = persona("manager");
    mockParams = { id: PROJECT_ID, type: "released_funds" };
    mockPost.mockImplementation(async (_path: string, options: unknown) => ({
      data: {
        ...INVOICE_RELEASE,
        id: "created-1",
        ...(options as { body: Record<string, unknown> }).body,
      },
      response: { status: 201, statusText: "Created" },
    }));
  });

  it("presets the released-funds type, posts the invoice and opens its detail", async () => {
    await renderWithProviders(<NewInvoiceScreen />);

    expect(await screen.findByTestId("invoice-type")).toHaveTextContent(
      containing(i18n.t("invoices.types.released_funds")),
    );
    await fireEvent.changeText(
      screen.getByTestId("invoice-recipient"),
      "Banque",
    );
    await fireEvent.changeText(
      screen.getByTestId("invoice-item-0-description"),
      "Déblocage 2",
    );
    await fireEvent.changeText(
      screen.getByTestId("invoice-item-0-price"),
      "5000",
    );
    await fireEvent.press(screen.getByTestId("invoice-submit"));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        "/api/v1/projects/{project_id}/invoices",
        expect.objectContaining({
          body: expect.objectContaining({
            type: "released_funds",
            recipient_name: "Banque",
            items: [
              expect.objectContaining({
                description: "Déblocage 2",
                unit_price: 5000,
              }),
            ],
          }),
        }),
      ),
    );
    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/invoices/created-1`,
      ),
    );
    expect(screen.queryByTestId("invoice-form-error")).toBeNull();
  });
});

describe("invoice detail · manager", () => {
  beforeEach(() => {
    mockPersona = persona("manager");
    mockParams = { id: PROJECT_ID, invoiceId: INVOICE_MATERIALS.id };
    mockPatch.mockImplementation(async () => ({
      data: { ...INVOICE_MATERIALS, refundable_status: "refundable" },
      response: { status: 200, statusText: "OK" },
    }));
  });

  it("shows the write actions and hands a materials expense to the company refund flow", async () => {
    await renderWithProviders(<InvoiceDetailScreen />);

    expect(await screen.findByTestId("invoice-actions")).toBeTruthy();
    expect(screen.getByTestId("invoice-edit")).toBeTruthy();
    expect(screen.getByTestId("invoice-delete")).toBeTruthy();
    expect(screen.getByTestId("attachment-add")).toBeTruthy();

    // Company project + materials invoice not yet in the refund workflow → transfer prompt.
    const transfer = await screen.findByTestId("invoice-transfer-company");
    await fireEvent.press(transfer);
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        "/api/v1/billing/materials-expenses/{invoice_id}",
        expect.objectContaining({
          params: { path: { invoice_id: INVOICE_MATERIALS.id } },
          body: expect.objectContaining({ refundable_status: "refundable" }),
        }),
      ),
    );

    await fireEvent.press(screen.getByTestId("invoice-edit"));
    expect(mockRouter.push).toHaveBeenCalledWith(
      `/projects/${PROJECT_ID}/invoices/${INVOICE_MATERIALS.id}/edit`,
    );
  });
});

describe("invoice detail · member (deep link)", () => {
  beforeEach(() => {
    mockPersona = persona("member");
    mockParams = { id: PROJECT_ID, invoiceId: INVOICE_MATERIALS.id };
  });

  it("keeps the sheet readable but hides every write control", async () => {
    await renderWithProviders(<InvoiceDetailScreen />);

    expect(await screen.findByTestId("invoice-actions")).toBeTruthy();
    expect(screen.getByTestId("invoice-print")).toBeTruthy();
    // Wait for the project row (the scoped permissions) before judging the gated controls.
    await waitFor(() =>
      expect(callsTo(mockGet, "/api/v1/projects/{project_id}")).toHaveLength(1),
    );
    expect(screen.queryByTestId("invoice-edit")).toBeNull();
    expect(screen.queryByTestId("invoice-delete")).toBeNull();
    expect(screen.queryByTestId("attachment-add")).toBeNull();
    expect(screen.queryByTestId("invoice-transfer-company")).toBeNull();
    expect(screen.queryByTestId("invoice-mark-refunded")).toBeNull();

    // The highlight palette stays visible but inert (a tap would PUT the invoice).
    await fireEvent.press(screen.getByTestId("detail-highlight-green"));
    expect(mockPut).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
  });
});
