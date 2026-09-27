import { fireEvent, screen, waitFor } from "@testing-library/react-native";

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
 * Members per company role. Assigning and unassigning are `project:manage_users` on the
 * project's scoped permissions — the endpoints require nothing else, so `project:invite` no
 * longer widens that gate; it governs the legacy invitation list and its Revoke alone. A
 * manager and an admin get both, a member reads the roster and nothing else. The invitations
 * query is issued only for a caller holding `project:invite`, so a member never asks for a
 * list the backend would refuse.
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

  it("asks before revoking a pending invitation", async () => {
    mockCurrent = persona("manager");
    await renderWithProviders(<ProjectMembersSection />);

    await waitFor(() =>
      expect(screen.getByTestId("invitation-revoke-i1")).toBeTruthy(),
    );
    await fireEvent.press(screen.getByTestId("invitation-revoke-i1"));
    // Nothing leaves before the confirmation is accepted.
    expect(mockPost).not.toHaveBeenCalled();
    expect(screen.getByTestId("confirm-dialog")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("confirm-ok"));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        "/api/v1/invitations/{invitation_id}/revoke",
        expect.anything(),
      ),
    );
  });

  it("drops assign and remove without project:manage_users, keeping Revoke", async () => {
    mockCurrent = persona("manager", { deny: ["project:manage_users"] });
    await renderWithProviders(<ProjectMembersSection />);

    await waitFor(() => expect(screen.getByText("Minh Worker")).toBeTruthy());
    // The assignment endpoints require project:manage_users and nothing else.
    await waitFor(() =>
      expect(screen.queryByTestId("members-assign")).toBeNull(),
    );
    expect(screen.queryByTestId("member-remove-u-member")).toBeNull();
    expect(callsTo(mockGet, PERSONS_PATH)).toHaveLength(0);
    // project:invite is untouched, so the invitation list and its Revoke stay.
    await waitFor(() =>
      expect(screen.getByTestId("invitation-revoke-i1")).toBeTruthy(),
    );
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

describe("Members · who a manager may remove", () => {
  const OTHERS = [
    {
      user_id: "u-admin",
      email: "qa.admin@example.com",
      display_name: "Admin Persona",
      role_name: "admin",
      joined_at: null,
    },
    {
      user_id: "u-manager-2",
      email: "other.manager@example.com",
      display_name: "Other Manager",
      role_name: "manager",
      joined_at: null,
    },
  ];

  function withOthers() {
    const answer = answerGet(() => mockCurrent);
    mockGet.mockImplementation(async (path: string, options?: unknown) =>
      path === MEMBERS_PATH
        ? {
            data: { members: [...MEMBERS, ...OTHERS] },
            response: { status: 200, statusText: "OK" },
          }
        : answer(path, options as never),
    );
  }

  it("offers a manager Remove on company members only, as the backend allows", async () => {
    mockCurrent = persona("manager");
    withOthers();
    await renderWithProviders(<ProjectMembersSection />);

    expect(await screen.findByTestId("member-remove-u-member")).toBeTruthy();
    expect(screen.queryByTestId("member-remove-u-admin")).toBeNull();
    expect(screen.queryByTestId("member-remove-u-manager-2")).toBeNull();
  });

  it("lets an admin remove managers and admins too", async () => {
    mockCurrent = persona("admin");
    withOthers();
    await renderWithProviders(<ProjectMembersSection />);

    expect(await screen.findByTestId("member-remove-u-manager-2")).toBeTruthy();
    expect(screen.getByTestId("member-remove-u-member")).toBeTruthy();
    expect(screen.getByTestId("member-remove-u-manager")).toBeTruthy();
  });
});

describe("Members · phone sign-ups", () => {
  it("never shows the synthetic address the backend stores for a phone-only account", async () => {
    mockCurrent = persona("manager");
    const answer = answerGet(() => mockCurrent);
    const phoneOnly = {
      user_id: "u-phone",
      email: "phone-33600000097@no-email.folio.flowitup.com",
      display_name: "QA Waiting C",
      role_name: "member",
      joined_at: null,
    };
    mockGet.mockImplementation(async (path: string, options?: unknown) =>
      path === MEMBERS_PATH
        ? {
            data: { members: [...MEMBERS, phoneOnly] },
            response: { status: 200, statusText: "OK" },
          }
        : answer(path, options as never),
    );
    await renderWithProviders(<ProjectMembersSection />);

    expect(await screen.findByText("QA Waiting C")).toBeTruthy();
    expect(screen.getByText("+33600000097")).toBeTruthy();
    expect(screen.queryByText(/no-email\.folio/)).toBeNull();

    await fireEvent.press(screen.getByTestId("member-remove-u-phone"));
    expect(screen.queryByText(/no-email\.folio/)).toBeNull();
  });
});
