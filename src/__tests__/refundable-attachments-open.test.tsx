import { fireEvent, screen } from "@testing-library/react-native";

import RefundableExpensesScreen from "../../app/(app)/(tabs)/billing/refundable";
import type { RefundableExpense } from "@/features/invoices/invoice-types";
import {
  COMPANY_ID,
  ok,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";

/**
 * The refundable list only counted each expense's files; the web opens them in its preview
 * dialog. Each file is now a link: a PDF goes to the in-app viewer through `openFile`.
 */
const mockCurrent = persona("admin");

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => undefined,
}));

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: mockCurrent.user }),
}));

const mockOpenFile = jest.fn();
jest.mock("@/lib/files/open-file", () => ({
  openFile: (...args: unknown[]) => mockOpenFile(...args),
}));

const EXPENSE: RefundableExpense = {
  id: "inv-1",
  project_id: "p1",
  project_name: "Rue de Rivoli",
  invoice_number: "FR-2026-0001",
  recipient_name: "Leroy Merlin",
  issue_date: "2026-09-01",
  total_amount: 120,
  refundable_status: "refundable",
  has_bank_refund: false,
  attachments: [
    {
      id: "att-1",
      filename: "ticket.pdf",
      mime_type: "application/pdf",
      size_bytes: 2048,
    },
  ],
};

const mockGet = jest.fn(async (path: string) => {
  if (path === "/api/v1/companies")
    return ok({
      items: [
        {
          company: { id: COMPANY_ID, legal_name: "Folio QA" },
          access: {
            role: "admin",
            is_primary: true,
            attached_at: "2026-09-01T08:00:00Z",
          },
        },
      ],
    });
  if (path === "/api/v1/billing/materials-expenses")
    return ok({ items: [EXPENSE], total: 1, summary: null });
  return ok({});
});
jest.mock("@/api/client", () => ({
  api: { GET: (path: string) => mockGet(path) },
}));

beforeEach(() => {
  mockOpenFile.mockReset();
  mockOpenFile.mockResolvedValue("file:///cache/download-1/ticket.pdf");
});

it("opens an expense's attached file from the refundable list", async () => {
  await renderWithProviders(<RefundableExpensesScreen />);
  const link = await screen.findByTestId("refundable-attachment-att-1");
  expect(link).toHaveTextContent("ticket.pdf");
  fireEvent.press(link);
  expect(mockOpenFile).toHaveBeenCalledWith(
    "/api/v1/attachments/att-1/download",
    "ticket.pdf",
    "application/pdf",
  );
});
