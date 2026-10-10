import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import i18n from "@/i18n";
import {
  useCancelPendingMember,
  type CompanyPersonEntry,
} from "@/features/companies/company-members-api";
import { PendingPersonRow } from "@/features/companies/company-members-parts";

const mockDelete = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: jest.fn(),
    POST: jest.fn(),
    PUT: jest.fn(),
    DELETE: (...args: unknown[]) => mockDelete(...args),
  },
}));

const PENDING: CompanyPersonEntry = {
  person_id: "person-9",
  name: "Typo Quebec",
  phone: "+33620350088",
  linked_user_id: null,
  assigned_project_ids: [],
  is_active: true,
  pending: true,
  labor_role_id: null,
  default_daily_rate: null,
};

function Harness() {
  const cancel = useCancelPendingMember();
  return (
    <PendingPersonRow
      person={PENDING}
      onCancel={() =>
        cancel.mutate({ companyId: "c1", personId: PENDING.person_id })
      }
    />
  );
}

describe("cancelling a pending member", () => {
  it("offers the action on the pending row and calls the cancel endpoint", async () => {
    mockDelete.mockResolvedValue({
      data: undefined,
      error: undefined,
      response: { status: 204 },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    await render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    expect(
      screen.getByText(i18n.t("companies.members.pending.cancel")),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId("pending-person-cancel-person-9"));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1));
    expect(mockDelete).toHaveBeenCalledWith(
      "/api/v1/companies/{company_id}/members/{person_id}",
      { params: { path: { company_id: "c1", person_id: "person-9" } } },
    );
  });
});
