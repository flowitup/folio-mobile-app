import { act, render, screen, waitFor } from "@testing-library/react-native";
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { AppState, Text } from "react-native";

import { AuthProvider, useAuth } from "@/auth/auth-context";

type AppStateListener = (state: string) => void;
let appStateListener: AppStateListener | undefined;

// Spy on the real `AppState` singleton (same object auth-context.tsx imports) instead of
// mocking the whole "react-native" module — NativeWind's css-interop runtime touches other
// react-native internals at import time and a full module mock trips over that.
jest.spyOn(AppState, "addEventListener").mockImplementation(
  // @ts-expect-error - the real signature covers more events than this test needs
  (_event: string, callback: AppStateListener) => {
    appStateListener = callback;
    return { remove: jest.fn() };
  },
);

jest.mock("@/auth/token-storage", () => ({
  getStoredTokens: jest.fn(async () => ({ refreshToken: "stored-refresh" })),
  setStoredTokens: jest.fn(async () => undefined),
  clearStoredTokens: jest.fn(async () => undefined),
}));

jest.mock("@/features/push/push-device-registration", () => ({
  unregisterPushDevice: jest.fn(async () => undefined),
  releasePushRegistrationLocally: jest.fn(async () => undefined),
}));

const mockGet = jest.fn();
const mockRefreshAccessToken = jest.fn(async () => "new-access-token");
jest.mock("@/api/client", () => ({
  api: { GET: (...args: unknown[]) => mockGet(...args) },
  refreshAccessToken: () => mockRefreshAccessToken(),
  setSessionExpiredHandler: jest.fn(),
}));

function meResponse(role: string) {
  return {
    data: {
      id: "u1",
      email: "a@example.com",
      permissions: [],
      roles: [],
      companies: [
        { id: "c1", legal_name: "Folio Demo SARL", role, is_primary: true },
      ],
    },
  };
}

// `AuthProvider` reads the query client (it clears the cache on sign-out), exactly as the
// app nests it: QueryClientProvider → AuthProvider.
function renderAuthed(children: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>,
  );
}

function RoleProbe() {
  const { user, status } = useAuth();
  if (status !== "signedIn" || !user) return <Text testID="role">none</Text>;
  return <Text testID="role">{user.companies?.[0]?.role ?? "none"}</Text>;
}

describe("auth foreground refresh", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockRefreshAccessToken.mockClear();
    appStateListener = undefined;
  });

  it("re-fetches /auth/me when the app becomes active, applying a role change without re-login", async () => {
    mockGet.mockResolvedValueOnce(meResponse("member"));

    await renderAuthed(<RoleProbe />);

    await waitFor(() =>
      expect(screen.getByTestId("role")).toHaveTextContent("member"),
    );
    expect(appStateListener).toBeDefined();

    mockGet.mockResolvedValueOnce(meResponse("admin"));

    await act(async () => {
      appStateListener?.("active");
    });

    await waitFor(() =>
      expect(screen.getByTestId("role")).toHaveTextContent("admin"),
    );
  });

  it("mints a fresh access token via /auth/refresh before re-fetching /auth/me", async () => {
    mockGet.mockResolvedValueOnce(meResponse("member"));

    await renderAuthed(<RoleProbe />);

    await waitFor(() =>
      expect(screen.getByTestId("role")).toHaveTextContent("member"),
    );

    mockGet.mockResolvedValueOnce(meResponse("member"));
    await act(async () => {
      appStateListener?.("active");
    });

    await waitFor(() =>
      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1),
    );
    // GET("/auth/me") is called once on mount and once on foreground.
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it("flips TanStack Query's focusManager so other queries refetch on foreground/background", async () => {
    const setFocusedSpy = jest.spyOn(focusManager, "setFocused");
    mockGet.mockResolvedValueOnce(meResponse("member"));

    await renderAuthed(<RoleProbe />);
    await waitFor(() =>
      expect(screen.getByTestId("role")).toHaveTextContent("member"),
    );

    mockGet.mockResolvedValueOnce(meResponse("member"));
    await act(async () => {
      appStateListener?.("active");
    });
    expect(setFocusedSpy).toHaveBeenLastCalledWith(true);

    await act(async () => {
      appStateListener?.("background");
    });
    expect(setFocusedSpy).toHaveBeenLastCalledWith(false);

    setFocusedSpy.mockRestore();
  });

  it("does not drop a re-read asked for while another runs: creating a company during a foreground refresh", async () => {
    mockGet.mockResolvedValueOnce(meResponse("member"));
    const handle: { refreshUser?: () => Promise<void> } = {};
    function Capture() {
      const { refreshUser } = useAuth();
      useEffect(() => {
        handle.refreshUser = refreshUser;
      });
      return <RoleProbe />;
    }
    await renderAuthed(<Capture />);
    await waitFor(() =>
      expect(screen.getByTestId("role")).toHaveTextContent("member"),
    );

    // The foreground read is on its way and answers with the state from before the creation.
    let answerForeground: (value: unknown) => void = () => undefined;
    mockGet.mockImplementationOnce(
      () => new Promise((resolve) => (answerForeground = resolve)),
    );
    await act(async () => {
      appStateListener?.("active");
    });

    // Meanwhile the company is created: its success asks for the user again, twice even.
    mockGet.mockResolvedValueOnce(meResponse("admin"));
    let afterCreate: Promise<void> | undefined;
    let again: Promise<void> | undefined;
    await act(async () => {
      afterCreate = handle.refreshUser!();
      again = handle.refreshUser!();
    });
    expect(again).toBe(afterCreate);

    await act(async () => {
      answerForeground(meResponse("member"));
      await afterCreate;
    });
    await waitFor(() =>
      expect(screen.getByTestId("role")).toHaveTextContent("admin"),
    );
    // Mount, foreground, and one shared read for both later calls.
    expect(mockGet).toHaveBeenCalledTimes(3);
  });
});
