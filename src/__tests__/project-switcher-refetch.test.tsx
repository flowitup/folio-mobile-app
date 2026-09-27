import { render } from "@testing-library/react-native";

import "@/i18n";
import { ProjectSwitcherSheet } from "@/components/shell/project-switcher-sheet";

/**
 * The project list is cached for the session: opening the switcher must refetch it, or a
 * project the user was just assigned to stays missing until the app is relaunched.
 */
let mockSheet: string | null = null;
const mockRefetch = jest.fn();

jest.mock("@/components/shell/shell-context", () => ({
  useShell: () => ({
    sheet: mockSheet,
    closeSheet: jest.fn(),
    tabBarHeight: 0,
  }),
}));
jest.mock("@/features/projects/selected-project", () => ({
  useSelectedProject: () => ({
    projects: [],
    projectId: "",
    select: jest.fn(),
    refetch: mockRefetch,
  }),
}));
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: null }),
}));
jest.mock("@/features/companies/companies-api", () => ({
  useMyCompanies: () => ({ data: [] }),
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
});
