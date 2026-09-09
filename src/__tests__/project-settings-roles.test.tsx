import { screen, waitFor } from "@testing-library/react-native";

import ProjectSettingsSection from "../../app/(app)/(tabs)/projects/[id]/settings";
import {
  answerGet,
  ok,
  persona,
  project,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";
import type { Persona } from "./helpers/release-qa-fixtures";

/**
 * Project settings per company role. The card itself is readable by anyone on the project;
 * Edit needs `project:update` and Delete `project:delete` — with the project owner keeping
 * both whatever the matrix says, which is how a manager who created the project can still
 * retire it. A member sees the fields and no button.
 */
let mockCurrent: Persona = persona("manager");
let mockOwnerId = "u-admin";

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
const mockPut = jest.fn();
const mockDelete = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    PUT: (...args: unknown[]) => mockPut(...args),
    DELETE: (...args: unknown[]) => mockDelete(...args),
  },
}));

/** The QA project with the owner under test — `project()` always owns it to the admin. */
function answerWithOwner() {
  return async (path: string, options?: unknown) => {
    if (path === "/api/v1/projects/{project_id}")
      return ok({ ...project(mockCurrent.scoped), owner_id: mockOwnerId });
    return answerGet(() => mockCurrent)(path, options as never);
  };
}

beforeEach(() => {
  mockGet.mockReset();
  mockPut.mockReset();
  mockDelete.mockReset();
  mockOwnerId = "u-admin";
  mockGet.mockImplementation(answerWithOwner());
});

describe("Project settings per role", () => {
  it("gives an admin both Edit and Delete", async () => {
    mockCurrent = persona("admin");
    await renderWithProviders(<ProjectSettingsSection />);

    await waitFor(() =>
      expect(screen.getByTestId("project-edit")).toBeTruthy(),
    );
    expect(screen.getByTestId("project-delete")).toBeTruthy();
  });

  it("gives a manager Edit but not Delete", async () => {
    mockCurrent = persona("manager");
    await renderWithProviders(<ProjectSettingsSection />);

    await waitFor(() =>
      expect(screen.getByTestId("project-edit")).toBeTruthy(),
    );
    expect(screen.queryByTestId("project-delete")).toBeNull();
  });

  it("gives the owning manager Delete back", async () => {
    mockCurrent = persona("manager");
    mockOwnerId = mockCurrent.user.id;
    await renderWithProviders(<ProjectSettingsSection />);

    await waitFor(() =>
      expect(screen.getByTestId("project-delete")).toBeTruthy(),
    );
  });

  it("shows a member the fields and no write control", async () => {
    mockCurrent = persona("member");
    await renderWithProviders(<ProjectSettingsSection />);

    // The card is what settles; only then is an absent button meaningful.
    await waitFor(() =>
      expect(screen.getByText("Folio QA Project")).toBeTruthy(),
    );
    expect(screen.queryByTestId("project-edit")).toBeNull();
    expect(screen.queryByTestId("project-delete")).toBeNull();
    expect(mockPut).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("hides Edit from a manager denied project:update here", async () => {
    mockCurrent = persona("manager", { deny: ["project:update"] });
    await renderWithProviders(<ProjectSettingsSection />);

    await waitFor(() =>
      expect(screen.getByText("Folio QA Project")).toBeTruthy(),
    );
    await waitFor(() =>
      expect(screen.queryByTestId("project-edit")).toBeNull(),
    );
  });
});
