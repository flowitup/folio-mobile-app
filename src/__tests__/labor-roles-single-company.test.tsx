/**
 * An account an admin attached to a company is never primary. The labor roles screen read the
 * primary flag alone, so a manager attached that way lost the create control although the
 * backend accepts the writes; with several companies it could manage none. The screen now works
 * on one company (picked, else the selected project's, else primary, else the oldest) and sends
 * that company with every read and create.
 */

import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import "@/i18n";
import LaborRolesScreen from "../../app/(app)/(tabs)/settings/labor-roles";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let mockCompanies: { id: string; is_primary: boolean; legal_name?: string }[] =
  [];
let mockProjectCompanyId: string | undefined;
const mockRolesCompany = jest.fn();
const mockCreateCompany = jest.fn();
const mockUser = {
  id: "u1",
  is_platform_ops: false,
  permissions: [],
  companies: [
    { id: "c1", legal_name: "A", role: "manager" },
    { id: "c2", legal_name: "B", role: "manager" },
  ],
};

jest.mock("@/api/client", () => ({ api: {} }));
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock("@/features/companies/companies-api", () => ({
  ...jest.requireActual("@/features/companies/companies-api"),
  useMyCompanies: () => ({ data: mockCompanies }),
}));
jest.mock("@/features/labor/labor-api", () => ({
  useLaborRoles: (companyId: string | undefined) => (mockRolesCompany(companyId), {
    data: { roles: [], palette: [] },
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useCreateLaborRole: (companyId: string | undefined) => (
    mockCreateCompany(companyId), { mutate: jest.fn(), isPending: false }
  ),
  useUpdateLaborRole: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteLaborRole: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("@/features/projects/selected-project", () => ({
  useOptionalSelectedProject: () =>
    mockProjectCompanyId
      ? { project: { company_id: mockProjectCompanyId } }
      : undefined,
}));
jest.mock("@/lib/query/use-refetch-on-focus", () => ({
  useRefetchOnFocus: jest.fn(),
}));

async function renderScreen() {
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <LaborRolesScreen />
    </SafeAreaProvider>,
  );
}

describe("labor roles management gate", () => {
  it("shows the create control to a manager of their only, non-primary company", async () => {
    mockCompanies = [{ id: "c1", is_primary: false }];
    await renderScreen();
    expect(screen.getByTestId("role-create")).toBeTruthy();
  });

  it("works on the oldest company with several companies and none primary", async () => {
    mockProjectCompanyId = undefined;
    mockCompanies = [
      { id: "c1", is_primary: false, legal_name: "A" },
      { id: "c2", is_primary: false, legal_name: "B" },
    ];
    await renderScreen();
    expect(screen.getByTestId("role-create")).toBeTruthy();
    expect(screen.getByTestId("roles-company")).toBeTruthy();
    expect(mockRolesCompany).toHaveBeenLastCalledWith("c1");
    expect(mockCreateCompany).toHaveBeenLastCalledWith("c1");
  });

  it("opens on the selected project's company", async () => {
    mockProjectCompanyId = "c2";
    mockCompanies = [
      { id: "c1", is_primary: true, legal_name: "A" },
      { id: "c2", is_primary: false, legal_name: "B" },
    ];
    await renderScreen();
    expect(mockRolesCompany).toHaveBeenLastCalledWith("c2");
    expect(mockCreateCompany).toHaveBeenLastCalledWith("c2");
  });

  it("hides the create control in a company where the user is a member", async () => {
    mockProjectCompanyId = undefined;
    mockCompanies = [{ id: "c3", is_primary: true, legal_name: "C" }];
    await renderScreen();
    expect(screen.queryByTestId("role-create")).toBeNull();
    expect(screen.getByTestId("roles-company-name")).toBeTruthy();
  });
});
