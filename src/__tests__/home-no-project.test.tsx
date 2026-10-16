import { fireEvent, screen } from "@testing-library/react-native";

import i18n from "@/i18n";
import { NoProjectYet } from "@/features/dashboard/no-project-yet";
import { renderWithProviders } from "./helpers/release-qa-fixtures";

/**
 * Home with no project: an admin gets "Create a project", which opens the switcher on its
 * new-project form; anyone else is told an admin has to add them to a project.
 */
let mockRole: "admin" | "member" = "admin";
const mockOpenSheet = jest.fn();

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      permissions: [],
      companies: [
        { id: "c1", legal_name: "Folio QA", role: mockRole, is_primary: true },
      ],
      is_platform_ops: false,
    },
  }),
}));

jest.mock("@/components/shell/shell-context", () => ({
  ...jest.requireActual("@/components/shell/shell-context"),
  useShell: () => ({
    sheet: null,
    openSheet: mockOpenSheet,
    closeSheet: jest.fn(),
  }),
}));

beforeEach(() => {
  mockOpenSheet.mockReset();
});

describe("Home without a project", () => {
  it("offers an admin to create one, through the switcher's form", async () => {
    mockRole = "admin";
    await renderWithProviders(<NoProjectYet />);

    expect(screen.getByText(i18n.t("home.noProjectAdmin"))).toBeTruthy();
    await fireEvent.press(screen.getByTestId("home-create-project"));
    expect(mockOpenSheet).toHaveBeenCalledWith("switcher");
  });

  it("tells a member that an admin has to add them to a project", async () => {
    mockRole = "member";
    await renderWithProviders(<NoProjectYet />);

    expect(screen.getByText(i18n.t("home.noProjectMember"))).toBeTruthy();
    expect(screen.queryByTestId("home-create-project")).toBeNull();
  });
});
