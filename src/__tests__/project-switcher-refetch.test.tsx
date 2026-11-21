import { render } from "@testing-library/react-native";

import "@/i18n";
import { ProjectSwitcherSheet } from "@/components/shell/project-switcher-sheet";

/**
 * The project list is cached for the session: opening the switcher must refetch it, or a
 * project the user was just assigned to stays missing until the app is relaunched.
 */
let mockSheet: string | null = null;
const mockRefetch = jest.fn();
let mockProjects: unknown[] = [];
let mockCompanies: unknown[] = [];

jest.mock("@/components/shell/shell-context", () => ({
  useShell: () => ({
    sheet: mockSheet,
    closeSheet: jest.fn(),
    tabBarHeight: 0,
  }),
}));
jest.mock("@/features/projects/selected-project", () => ({
  useSelectedProject: () => ({
    projects: mockProjects,
    projectId: "",
    select: jest.fn(),
    refetch: mockRefetch,
  }),
}));
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: null }),
}));
jest.mock("@/features/companies/companies-api", () => ({
  useMyCompanies: () => ({ data: mockCompanies }),
}));
jest.mock("@/features/projects/project-form-sheet", () => ({
  ProjectFormSheet: () => null,
}));
jest.mock("@/features/projects/projects-api", () => ({
  projectCan: () => false,
  useCreateProject: () => ({ mutateAsync: jest.fn() }),
}));

describe("project switcher sheet", () => {
  beforeEach(() => {
    mockSheet = null;
    mockRefetch.mockClear();
    mockProjects = [];
    mockCompanies = [];
  });

  it("refetches the project list each time it opens", async () => {
    const view = await render(<ProjectSwitcherSheet />);
    expect(mockRefetch).not.toHaveBeenCalled();

    mockSheet = "switcher";
    await view.rerender(<ProjectSwitcherSheet />);
    expect(mockRefetch).toHaveBeenCalledTimes(1);

    mockSheet = null;
    await view.rerender(<ProjectSwitcherSheet />);
    mockSheet = "switcher";
    await view.rerender(<ProjectSwitcherSheet />);
    expect(mockRefetch).toHaveBeenCalledTimes(2);
  });

  it("does not repeat the company name under each project", async () => {
    mockSheet = "switcher";
    mockCompanies = [
      { id: "c1", legal_name: "Alpha BTP", role: "admin" },
      { id: "c2", legal_name: "Beta Rénovation", role: "admin" },
    ];
    mockProjects = [
      { id: "p1", name: "Chantier A", company_id: "c1", budget: 100, spent: 10, user_count: 1 },
      { id: "p2", name: "Chantier B", company_id: "c2", budget: 100, spent: 10, user_count: 1 },
    ];
    const view = await render(<ProjectSwitcherSheet />);

    expect(view.getByText("Chantier A")).toBeTruthy();
    expect(view.queryByTestId("switcher-company-p1")).toBeNull();
    expect(view.queryByText("Alpha BTP")).toBeNull();
    expect(view.queryByText("Beta Rénovation")).toBeNull();
  });
});
