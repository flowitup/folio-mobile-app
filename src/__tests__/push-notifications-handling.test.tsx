/**
 * Tapped pushes are handled once. expo-notifications keeps the last response until it is
 * cleared, and the signed-in area reads it every time it mounts — after a sign-out and sign-in
 * the same push opened its project again, for whichever account signed in.
 *
 * A push about the user's own company role or grants refreshes `/auth/me` and the company list,
 * which the auth context and the query cache otherwise keep stale until the next foreground.
 */

import { act, render } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";

import { usePushNotifications } from "@/features/push/use-push-notifications";

type Listener = (event: unknown) => void;
const mockListeners: { received?: Listener; responded?: Listener } = {};
let mockLastResponse: unknown = null;

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn((listener: Listener) => {
    mockListeners.received = listener;
    return { remove: jest.fn() };
  }),
  addNotificationResponseReceivedListener: jest.fn((listener: Listener) => {
    mockListeners.responded = listener;
    return { remove: jest.fn() };
  }),
  getLastNotificationResponseAsync: jest.fn(async () => mockLastResponse),
  clearLastNotificationResponse: jest.fn(() => {
    mockLastResponse = null;
  }),
}));

jest.mock("@/features/push/push-device-registration", () => ({
  ...jest.requireActual("@/features/push/push-device-registration"),
  registerPushDevice: jest.fn(async () => null),
}));

const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: mockNavigate }),
}));

const mockRefreshUser = jest.fn(async () => undefined);
jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ refreshUser: mockRefreshUser }),
}));

function response(data: Record<string, string>) {
  return { notification: { request: { content: { data } } } };
}

function SignedInArea() {
  usePushNotifications();
  return null;
}

async function mountSignedInArea(queryClient = new QueryClient()) {
  const view = await render(
    <QueryClientProvider client={queryClient}>
      <SignedInArea />
    </QueryClientProvider>,
  );
  // Let getLastNotificationResponseAsync() settle.
  await act(async () => {});
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLastResponse = null;
});

describe("usePushNotifications", () => {
  it("opens the push that launched the app once, not again after signing back in", async () => {
    mockLastResponse = response({ kind: "note_due", project_id: "p1" });

    const first = await mountSignedInArea();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/projects/p1/notes");
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();

    // Sign-out unmounts the signed-in area; signing in mounts it again.
    await first.unmount();
    await mountSignedInArea();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("clears a push tapped while the app runs once it is handled", async () => {
    await mountSignedInArea();

    await act(async () => {
      mockListeners.responded?.(response({ kind: "member_joined" }));
    });

    expect(mockNavigate).toHaveBeenCalledWith("/(app)/(tabs)");
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(
      1,
    );
  });

  it("refreshes the user and the companies when the user's own role changes", async () => {
    const queryClient = new QueryClient();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");
    await mountSignedInArea(queryClient);

    await act(async () => {
      mockListeners.received?.({
        request: {
          content: {
            data: { kind: "company_member_role_changed", company_id: "c1" },
          },
        },
      });
    });

    expect(mockRefreshUser).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["companies"] });
  });

  it("opens My companies, not the admin-only members screen, for a role change", async () => {
    await mountSignedInArea();

    await act(async () => {
      mockListeners.responded?.(
        response({ kind: "company_member_grants_changed", company_id: "c1" }),
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith("/settings/companies");
    expect(mockRefreshUser).toHaveBeenCalledTimes(1);
  });

  it("leaves the user alone for pushes that do not touch their access", async () => {
    await mountSignedInArea();

    await act(async () => {
      mockListeners.received?.({
        request: { content: { data: { kind: "submitted", project_id: "p1" } } },
      });
    });

    expect(mockRefreshUser).not.toHaveBeenCalled();
  });
});
