/**
 * Restoring the session at launch, and deleting the account.
 *
 * Launch used to sign out on any /auth/me answer without data (a 503 wiped a good session) and
 * hung on the splash forever when offline (the network error escaped the restore, unretried).
 * Only a definite answer ends the session now; everything else keeps the tokens and shows a
 * retry screen, which coming back to the app retries too.
 *
 * Deleting the account used to unregister the device from pushes first, so a deletion the
 * server refused (last admin) left a signed-in user without pushes until the next restart.
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import {
  AccountDeletionBlockedError,
  AuthProvider,
  useAuth,
} from "@/auth/auth-context";
import { SessionUnavailable } from "@/components/auth/session-unavailable";
import "@/i18n";

type AppStateListener = (state: string) => void;
let appStateListener: AppStateListener | undefined;
jest.spyOn(AppState, "addEventListener").mockImplementation(
  // @ts-expect-error - the real signature covers more events than this test needs
  (_event: string, callback: AppStateListener) => {
    appStateListener = callback;
    return { remove: jest.fn() };
  },
);

// What the client left in SecureStore: it clears the tokens itself when a refresh is refused.
let mockStoredRefresh: string | null = "stored-refresh";
const mockClearStoredTokens = jest.fn(async () => {
  mockStoredRefresh = null;
});
jest.mock("@/auth/token-storage", () => ({
  getStoredTokens: jest.fn(async () => ({
    accessToken: "access",
    refreshToken: mockStoredRefresh,
  })),
  setStoredTokens: jest.fn(async () => undefined),
  clearStoredTokens: () => mockClearStoredTokens(),
}));

const mockUnregister = jest.fn(async () => undefined);
const mockForgetPushToken = jest.fn(async () => undefined);
const mockClearPushResponse = jest.fn();
jest.mock("@/features/push/push-device-registration", () => ({
  unregisterPushDevice: () => mockUnregister(),
  forgetPushToken: () => mockForgetPushToken(),
  clearHandledPushResponse: () => mockClearPushResponse(),
}));

const mockGet = jest.fn();
const mockDelete = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    DELETE: (...args: unknown[]) => mockDelete(...args),
    POST: jest.fn(async () => ({ data: {}, response: { ok: true } })),
  },
  refreshAccessToken: jest.fn(async () => "unavailable"),
  setSessionExpiredHandler: jest.fn(),
}));

const ME = {
  data: { id: "u1", email: "a@example.com", permissions: [], companies: [] },
  response: { status: 200, ok: true },
};
const failed = (status: number) => ({
  error: { error: "Failed" },
  response: { status, ok: false },
});

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** Mirrors the root layout: the retry screen while the session cannot be confirmed. */
function Root() {
  const { status, deleteAccount } = useAuth();
  const [deleteError, setDeleteError] = useState("");
  if (status === "unavailable") return <SessionUnavailable />;
  return (
    <View>
      <Text testID="status">{status}</Text>
      <Pressable
        testID="delete"
        onPress={() =>
          void deleteAccount().catch((caught: Error) =>
            setDeleteError(caught.name),
          )
        }
      />
      <Text testID="delete-error">{deleteError}</Text>
    </View>
  );
}

function renderApp() {
  return render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

const status = () => screen.getByTestId("status");

beforeEach(() => {
  jest.clearAllMocks();
  mockStoredRefresh = "stored-refresh";
  appStateListener = undefined;
});

describe("session restore at launch", () => {
  it.each([429, 500, 503])(
    "keeps the tokens and offers a retry when /auth/me answers %i",
    async (code) => {
      mockGet.mockResolvedValue(failed(code));
      await renderApp();

      await waitFor(() =>
        expect(screen.getByTestId("session-unavailable")).toBeOnTheScreen(),
      );
      expect(mockClearStoredTokens).not.toHaveBeenCalled();
    },
  );

  it("keeps the tokens on a 401 whose refresh could not reach the server", async () => {
    mockGet.mockResolvedValue(failed(401));
    await renderApp();

    await waitFor(() =>
      expect(screen.getByTestId("session-unavailable")).toBeOnTheScreen(),
    );
    expect(mockClearStoredTokens).not.toHaveBeenCalled();
  });

  it("signs out when the client cleared the tokens after a refused refresh", async () => {
    mockGet.mockImplementation(async () => {
      mockStoredRefresh = null;
      return failed(401);
    });
    await renderApp();

    await waitFor(() => expect(status()).toHaveTextContent("signedOut"));
  });

  it("signs out when the account no longer exists", async () => {
    mockGet.mockResolvedValue(failed(404));
    await renderApp();

    await waitFor(() => expect(status()).toHaveTextContent("signedOut"));
    expect(mockClearStoredTokens).toHaveBeenCalled();
  });

  it("leaves the splash when offline, and Retry restores the session", async () => {
    mockGet.mockRejectedValueOnce(new TypeError("Network request failed"));
    await renderApp();

    await waitFor(() =>
      expect(screen.getByTestId("session-unavailable")).toBeOnTheScreen(),
    );
    expect(mockClearStoredTokens).not.toHaveBeenCalled();

    mockGet.mockResolvedValueOnce(ME);
    await fireEvent.press(screen.getByTestId("session-unavailable-retry"));

    await waitFor(() => expect(status()).toHaveTextContent("signedIn"));
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it("checks again when the app comes back to the foreground", async () => {
    mockGet.mockRejectedValueOnce(new TypeError("Network request failed"));
    await renderApp();
    await waitFor(() =>
      expect(screen.getByTestId("session-unavailable")).toBeOnTheScreen(),
    );

    mockGet.mockResolvedValueOnce(ME);
    await act(async () => {
      appStateListener?.("active");
    });

    await waitFor(() => expect(status()).toHaveTextContent("signedIn"));
  });

  it("lets the user sign out from the retry screen", async () => {
    mockGet.mockRejectedValue(new TypeError("Network request failed"));
    await renderApp();
    await waitFor(() =>
      expect(screen.getByTestId("session-unavailable")).toBeOnTheScreen(),
    );

    await fireEvent.press(screen.getByTestId("session-unavailable-sign-out"));

    await waitFor(() => expect(status()).toHaveTextContent("signedOut"));
    expect(mockClearStoredTokens).toHaveBeenCalled();
  });
});

describe("deleting the account", () => {
  it("keeps the push registration when the deletion is refused", async () => {
    mockGet.mockResolvedValue(ME);
    mockDelete.mockResolvedValue({
      error: { reason: "last_admin", company_name: "Co A" },
      response: { status: 409, ok: false },
    });
    await renderApp();
    await waitFor(() => expect(status()).toHaveTextContent("signedIn"));

    await fireEvent.press(screen.getByTestId("delete"));

    await waitFor(() =>
      expect(screen.getByTestId("delete-error")).toHaveTextContent(
        new AccountDeletionBlockedError("Co A").name,
      ),
    );
    expect(mockUnregister).not.toHaveBeenCalled();
    expect(mockForgetPushToken).not.toHaveBeenCalled();
    expect(status()).toHaveTextContent("signedIn");
  });

  it("keeps the push registration when the server fails", async () => {
    mockGet.mockResolvedValue(ME);
    mockDelete.mockResolvedValue(failed(500));
    await renderApp();
    await waitFor(() => expect(status()).toHaveTextContent("signedIn"));

    await fireEvent.press(screen.getByTestId("delete"));

    await waitFor(() =>
      expect(screen.getByTestId("delete-error")).toHaveTextContent("Error"),
    );
    expect(mockUnregister).not.toHaveBeenCalled();
    expect(mockForgetPushToken).not.toHaveBeenCalled();
  });

  it("forgets the local push token once the account is erased, then signs out", async () => {
    mockGet.mockResolvedValue(ME);
    mockDelete.mockResolvedValue({ response: { status: 204, ok: true } });
    await renderApp();
    await waitFor(() => expect(status()).toHaveTextContent("signedIn"));

    await fireEvent.press(screen.getByTestId("delete"));

    await waitFor(() => expect(status()).toHaveTextContent("signedOut"));
    expect(mockForgetPushToken).toHaveBeenCalledTimes(1);
    // The erasure already removed the device server-side; no DELETE /push/devices with a dead token.
    expect(mockUnregister).not.toHaveBeenCalled();
    // A push tapped under the erased account is not replayed for the next one.
    expect(mockClearPushResponse).toHaveBeenCalled();
  });
});
