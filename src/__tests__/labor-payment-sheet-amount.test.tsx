import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { createRef } from "react";

import i18n, { DEFAULT_LOCALE } from "@/i18n";
import { PaymentSheet } from "@/features/labor/labor-tab-sheets";
import {
  WORKER_MINH,
  WORKER_TUAN,
  callsTo,
  ok,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";

/**
 * Labor > Payments > Pay pre-filled the raw float balance (149.99 - 100.33 =
 * "49.66000000000001"), saved it as the unit price, and toasted "Invoice created.".
 * The balance is now pre-filled in cents with the locale's decimal mark, the saved
 * price is in cents, and the toast speaks of the payment, as on Salaries.
 */
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: (...args: unknown[]) => mockPost(...args),
  },
}));
const mockShowToast = jest.fn();
jest.mock("@/components/ui/toast", () => ({
  ...jest.requireActual("@/components/ui/toast"),
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

const INVOICES_PATH = "/api/v1/projects/{project_id}/invoices";
const ROWS = [
  { worker: WORKER_MINH, color: "#000", owed: 149.99, paid: 100.33 },
  { worker: WORKER_TUAN, color: "#111", owed: 300.1, paid: 100.2 },
];

beforeEach(async () => {
  await i18n.changeLanguage("fr");
  mockGet.mockReset();
  mockPost.mockReset();
  mockShowToast.mockReset();
  mockGet.mockImplementation(async () => ok([]));
  mockPost.mockImplementation(async () => ok({ id: "inv-1" }));
});

afterEach(async () => {
  await i18n.changeLanguage(DEFAULT_LOCALE);
});

async function renderSheet() {
  await renderWithProviders(
    <PaymentSheet
      ref={createRef<BottomSheetModal>()}
      projectId="p1"
      companyId={null}
      month="2026-10"
      rows={ROWS}
      initial={ROWS[0]}
    />,
  );
}

describe("labor payment sheet", () => {
  it("pre-fills the balance in cents with the locale's decimal mark", async () => {
    await renderSheet();
    await waitFor(() =>
      expect(screen.getByTestId("payment-amount").props.value).toBe("49,66"),
    );
  });

  it("saves the unit price in cents and toasts the payment once", async () => {
    await renderSheet();
    await waitFor(() =>
      expect(screen.getByTestId("payment-amount").props.value).toBe("49,66"),
    );
    await fireEvent.changeText(screen.getByTestId("payment-amount"), "12,345");
    await fireEvent.press(screen.getByTestId("payment-submit"));

    await waitFor(() =>
      expect(callsTo(mockPost, INVOICES_PATH)).toHaveLength(1),
    );
    expect(
      callsTo(mockPost, INVOICES_PATH)[0][1].body.items[0].unit_price,
    ).toBe(12.35);
    await waitFor(() => expect(mockShowToast).toHaveBeenCalled());
    expect(mockShowToast.mock.calls).toEqual([
      [i18n.t("salaries.paidToast"), "success"],
    ]);
  });
});
