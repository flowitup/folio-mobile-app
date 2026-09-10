import { screen, waitFor } from "@testing-library/react-native";

import ProjectMembersSection from "../../app/(app)/(tabs)/projects/[id]/members";
import {
  MEMBERS,
  answerGet,
  callsTo,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";
import type { Persona } from "./helpers/release-qa-fixtures";

/**
 * Members per company role. `canManage` is `project:manage_users` OR `project:invite` on the
 * project's scoped permissions — a manager and an admin get the assign button and the per-row
 * remove / revoke controls, a member reads the roster and nothing else. The invitations query
 * is issued only for a caller holding `project:invite`, so a member never asks for a list the
 * backend would refuse.
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

// The JWT-wide list keeps the company-wide matrix on purpose: the project row must decide
// alone, so a screen that OR-ed the JWT back in would hand a member the manage controls.
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: mockCurrent.user }),
}));

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: (...args: unknown[]) => mockPost(...args),
    PUT: (...args: unknown[]) => mockPut(...args),
    DELETE: (...args: unknown[]) => mockDelete(...args),
  },
}));

const MEMBERS_PATH = "/api/v1/projects/{project_id}/members";
/** The company directory the assign sheet loads — the backend reserves it to admins/managers. */
const PERSONS_PATH = "/api/v1/companies/{company_id}/persons";
const INVITATIONS_PATH =
  "/api/v1/invitations/projects/{project_id}/invitations";

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockPut.mockReset();
  mockDelete.mockReset();
  mockGet.mockImplementation(answerGet(() => mockCurrent));
});

describe("Members per role", () => {
  it("lets a manager assign, remove and revoke", async () => {
    mockCurrent = persona("manager");
    await renderWithProviders(<ProjectMembersSection />);

    await waitFor(() =>
      expect(screen.getByTestId("members-assign")).toBeTruthy(),
    );
    // Every assigned member is removable except yourself.
    expect(screen.getByTestId("member-remove-u-member")).toBeTruthy();
    expect(screen.queryByTestId("member-remove-u-manager")).toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId("invitation-revoke-i1")).toBeTruthy(),
    );
    expect(callsTo(mockGet, INVITATIONS_PATH).length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(callsTo(mockGet, PERSONS_PATH).length).toBeGreaterThan(0),
    );
  });

  it("gives an admin the same controls", async () => {
    mockCurrent = persona("admin");
    await renderWithProviders(<ProjectMembersSection />);

    await waitFor(() =>
      expect(screen.getByTestId("members-assign")).toBeTruthy(),
    );
    // An admin is never listed on the project, so no row is their own.
    for (const member of MEMBERS) {
      expect(
        screen.getByTestId(`member-remove-${member.user_id}`),
      ).toBeTruthy();
    }
  });

  it("shows a member the roster read-only and never asks for the invitations", async () => {
    mockCurrent = persona("member");
    await renderWithProviders(<ProjectMembersSection />);

    // Wait for the list to settle before asserting on absence, or everything is "absent".
    await waitFor(() => expect(screen.getByText("Minh Worker")).toBeTruthy());
    expect(screen.queryByTestId("members-assign")).toBeNull();
    for (const member of MEMBERS) {
      expect(
        screen.queryByTestId(`member-remove-${member.user_id}`),
      ).toBeNull();
    }
    expect(screen.queryByTestId("invitation-revoke-i1")).toBeNull();

    await waitFor(() =>
      expect(callsTo(mockGet, MEMBERS_PATH).length).toBeGreaterThan(0),
    );
    expect(callsTo(mockGet, INVITATIONS_PATH)).toHaveLength(0);
    // The assign sheet is not mounted for them, so its directory query never goes out either.
    expect(callsTo(mockGet, PERSONS_PATH)).toHaveLength(0);
    expect(mockPut).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("hides the manage controls when a D8 deny removes them from the project row", async () => {
    mockCurrent = persona("manager", {
      deny: ["project:manage_users", "project:invite"],
    });
    await renderWithProviders(<ProjectMembersSection />);

    // Settle both queries, then assert: the deny wins once the project row is known.
    await waitFor(() => expect(screen.getByText("Minh Worker")).toBeTruthy());
    await waitFor(() =>
      expect(screen.queryByTestId("members-assign")).toBeNull(),
    );
    expect(screen.queryByTestId("member-remove-u-member")).toBeNull();
    expect(screen.queryByTestId("invitation-revoke-i1")).toBeNull();
    // Both gated queries wait for the project's scoped answer, so the deny is never raced by a
    // request the JWT-wide list would have allowed.
    expect(callsTo(mockGet, INVITATIONS_PATH)).toHaveLength(0);
    expect(callsTo(mockGet, PERSONS_PATH)).toHaveLength(0);
  });
});
