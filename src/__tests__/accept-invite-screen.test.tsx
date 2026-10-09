import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import i18n from "@/i18n";
import { renderWithProviders } from "./helpers/release-qa-fixtures";

import AcceptInviteScreen from "../../app/accept-invite/[token]";
import { InviteActionError } from "@/features/invitations/invitations-api";

const mockVerifyInvite = jest.fn();
const mockRequestInviteCode = jest.fn();
const mockAcceptInvite = jest.fn();

jest.mock("@/features/invitations/invitations-api", () => {
  const actual = jest.requireActual("@/features/invitations/invitations-api");
  return {
    ...actual,
    verifyInvite: (...args: unknown[]) => mockVerifyInvite(...args),
    requestInviteCode: (...args: unknown[]) => mockRequestInviteCode(...args),
    acceptInvite: (...args: unknown[]) => mockAcceptInvite(...args),
  };
});

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
    back: jest.fn(),
    canGoBack: () => false,
    navigate: jest.fn(),
  }),
  useLocalSearchParams: () => ({ token: "tok-123" }),
}));

let mockAuthStatus: "signedOut" | "signedIn" = "signedOut";
const mockSignOut = jest.fn();
const mockSignInWithSession = jest.fn();
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    status: mockAuthStatus,
    user: mockAuthStatus === "signedIn" ? { email: "other@example.com" } : null,
    signOut: mockSignOut,
    signInWithSession: (...args: unknown[]) => mockSignInWithSession(...args),
  }),
}));

/** What POST /invitations/accept answers with — the invitee is signed in from here. */
const SESSION = {
  access_token: "access-token-stub",
  refresh_token: "refresh-token-stub",
  user: { id: "u-1", email: "invitee@example.com", display_name: "New User" },
};

const INVITE = {
  email: "invitee@example.com",
  expires_at: "2026-09-20T00:00:00Z",
  inviter_name: "Admin",
  project_name: "Chantier",
  role_name: "member",
};

beforeEach(() => {
  mockAuthStatus = "signedOut";
  mockVerifyInvite.mockReset().mockResolvedValue(INVITE);
  mockRequestInviteCode.mockReset();
  mockAcceptInvite.mockReset();
  mockReplace.mockReset();
  mockSignInWithSession.mockReset();
  mockSignOut.mockReset();
});

describe("accept-invite screen", () => {
  it("walks name+phone -> SMS code -> signed in, adopting the session acceptance returns", async () => {
    mockRequestInviteCode.mockResolvedValue({ expiresIn: 300 });
    mockAcceptInvite.mockResolvedValue(SESSION);

    await renderWithProviders(<AcceptInviteScreen />);

    await screen.findByTestId("invite-name");
    await fireEvent.changeText(screen.getByTestId("invite-name"), "New User");
    await fireEvent.changeText(
      screen.getByTestId("invite-phone"),
      "06 12 34 56 78",
    );
    await fireEvent.press(screen.getByTestId("invite-send-code"));

    await waitFor(() =>
      expect(mockRequestInviteCode).toHaveBeenCalledWith({
        token: "tok-123",
        phone: "+33612345678",
      }),
    );

    await screen.findByTestId("invite-code");
    await fireEvent.changeText(screen.getByTestId("invite-code"), "424242");
    await fireEvent.press(screen.getByTestId("invite-submit"));

    await waitFor(() =>
      expect(mockAcceptInvite).toHaveBeenCalledWith({
        token: "tok-123",
        name: "New User",
        phone: "+33612345678",
        code: "424242",
      }),
    );

    // Acceptance signs the invitee in, so the screen adopts that session
    // instead of sending them back through sign-in for a second code.
    await waitFor(() =>
      expect(mockSignInWithSession).toHaveBeenCalledWith(SESSION),
    );
    // ...and then navigates. This screen sits outside the Stack.Protected
    // guards, so adopting the session alone leaves the invitee sitting on the
    // invite screen — which, now that they are signed in, renders the "signed
    // in as someone else" branch offering to sign out of the session they just
    // earned. Assert the navigation itself, not merely the absence of a wrong one.
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/(app)/(tabs)"),
    );
  });

  it("asks for the existing account's phone, inline, when the invited address already has an account", async () => {
    mockRequestInviteCode.mockRejectedValue(
      new InviteActionError("account_exists"),
    );

    await renderWithProviders(<AcceptInviteScreen />);

    await screen.findByTestId("invite-name");
    await fireEvent.changeText(screen.getByTestId("invite-name"), "Someone");
    await fireEvent.changeText(
      screen.getByTestId("invite-phone"),
      "06 12 34 56 78",
    );
    await fireEvent.press(screen.getByTestId("invite-send-code"));

    await screen.findByText(i18n.t("acceptInvite.errors.accountExists"));
    expect(screen.queryByTestId("invite-error")).toBeNull();
    expect(screen.getByTestId("invite-phone")).toBeTruthy();
  });

  it("names the wait when the phone hit its hourly code cap", async () => {
    // Regression: the cap lasts up to an hour but read "Wait a minute and try again".
    mockRequestInviteCode.mockRejectedValue(
      new InviteActionError("hourly_limit", undefined, 44),
    );

    await renderWithProviders(<AcceptInviteScreen />);

    await screen.findByTestId("invite-name");
    await fireEvent.changeText(screen.getByTestId("invite-name"), "Someone");
    await fireEvent.changeText(
      screen.getByTestId("invite-phone"),
      "06 12 34 56 78",
    );
    await fireEvent.press(screen.getByTestId("invite-send-code"));

    await screen.findByText(i18n.t("login.errors.hourlyLimit", { count: 44 }));
  });

  it("shows an inline, translated error and keeps the typed details on a taken phone", async () => {
    mockRequestInviteCode.mockRejectedValue(
      new InviteActionError("phone_registered"),
    );

    await renderWithProviders(<AcceptInviteScreen />);

    await screen.findByTestId("invite-name");
    await fireEvent.changeText(screen.getByTestId("invite-name"), "New User");
    await fireEvent.changeText(
      screen.getByTestId("invite-phone"),
      "06 12 34 56 78",
    );
    await fireEvent.press(screen.getByTestId("invite-send-code"));

    await screen.findByText(i18n.t("login.errors.phoneTaken"));
    expect(screen.getByTestId("invite-name").props.value).toBe("New User");
    expect(screen.queryByTestId("invite-code")).toBeNull();
  });

  it("swaps to the whole-screen error card when the invitation expires mid-flow", async () => {
    mockRequestInviteCode.mockResolvedValue({ expiresIn: 300 });
    mockAcceptInvite.mockRejectedValue(new InviteActionError("expired"));

    await renderWithProviders(<AcceptInviteScreen />);

    await screen.findByTestId("invite-name");
    await fireEvent.changeText(screen.getByTestId("invite-name"), "New User");
    await fireEvent.changeText(
      screen.getByTestId("invite-phone"),
      "06 12 34 56 78",
    );
    await fireEvent.press(screen.getByTestId("invite-send-code"));

    await screen.findByTestId("invite-code");
    await fireEvent.changeText(screen.getByTestId("invite-code"), "424242");
    await fireEvent.press(screen.getByTestId("invite-submit"));

    await screen.findByTestId("invite-error");
    expect(
      screen.getByText(i18n.t("acceptInvite.errors.expired")),
    ).toBeTruthy();
  });

  it("shows the not-found error card when the token is unknown", async () => {
    mockVerifyInvite.mockResolvedValue({ error: "not_found" });

    await renderWithProviders(<AcceptInviteScreen />);

    await screen.findByTestId("invite-error");
    expect(
      screen.getByText(i18n.t("acceptInvite.errors.notFound")),
    ).toBeTruthy();
    // The header no longer promises "You're invited to join …" above a dead link.
    expect(screen.getByText(i18n.t("acceptInvite.errors.title"))).toBeTruthy();
    expect(
      screen.queryByText(i18n.t("acceptInvite.title", { projectName: "…" })),
    ).toBeNull();
  });

  it("keeps the invitation title while the invitation is valid", async () => {
    await renderWithProviders(<AcceptInviteScreen />);

    await screen.findByTestId("invite-name");
    expect(
      screen.getByText(
        i18n.t("acceptInvite.title", { projectName: INVITE.project_name }),
      ),
    ).toBeTruthy();
    expect(screen.queryByText(i18n.t("acceptInvite.errors.title"))).toBeNull();
  });

  it("blocks acceptance while a different account is already signed in on this device", async () => {
    mockAuthStatus = "signedIn";

    await renderWithProviders(<AcceptInviteScreen />);

    expect(await screen.findByTestId("invite-sign-out")).toBeTruthy();
    expect(screen.queryByTestId("invite-name")).toBeNull();
  });
});
