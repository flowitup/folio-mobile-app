/**
 * Signing out has to empty the React Query cache. Every cached list — companies, projects —
 * was fetched as the account that is leaving, and with a 30s stale window the next account to
 * sign in on the same phone reads it as its own: it sees a company it does not belong to, and
 * the onboarding gate decides on that stale answer instead of asking the backend.
 */

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Pressable, Text } from "react-native";

import { AuthProvider, useAuth } from "@/auth/auth-context";

jest.mock("@/auth/token-storage", () => ({
  getStoredTokens: jest.fn(async () => ({ refreshToken: "stored-refresh" })),
  setStoredTokens: jest.fn(async () => undefined),
  clearStoredTokens: jest.fn(async () => undefined),
}));

jest.mock("@/features/push/push-device-registration", () => ({
  unregisterPushDevice: jest.fn(async () => undefined),
  forgetPushToken: jest.fn(async () => undefined),
  clearHandledPushResponse: jest.fn(),
}));

const mockClearFiles = jest.fn();
jest.mock("@/lib/files/clear-local-files", () => ({
  clearLocalUserFiles: () => mockClearFiles(),
}));
const mockDeleteItem = jest.fn(async (_key: string) => undefined);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: (key: string) => mockDeleteItem(key),
}));

const mockGet = jest.fn(async () => ({
  data: {
    id: "u1",
    email: "leaving@example.com",
    permissions: [],
    companies: [{ id: "c1", legal_name: "Folio Demo SARL", role: "admin" }],
  },
}));
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...(args as [])),
    POST: jest.fn(async () => ({ data: {}, response: { ok: true } })),
    DELETE: jest.fn(async () => ({ response: { ok: true, status: 200 } })),
  },
  refreshAccessToken: jest.fn(async () => "new-access-token"),
  setSessionExpiredHandler: jest.fn(),
}));

function SignOutProbe() {
  const { status, signOut, deleteAccount } = useAuth();
  return (
    <Pressable testID="sign-out" onPress={() => void signOut()}>
      <Text testID="status">{status}</Text>
      <Pressable testID="delete" onPress={() => void deleteAccount()} />
    </Pressable>
  );
}

describe("signing out", () => {
  it("empties the query cache so the next account reads nothing of the previous one", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["companies", "mine"], [{ id: "c1" }]);

    await render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SignOutProbe />
        </AuthProvider>
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("signedIn"),
    );

    await fireEvent.press(screen.getByTestId("sign-out"));

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("signedOut"),
    );
    expect(queryClient.getQueryData(["companies", "mine"])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  describe("local files", () => {
    async function renderSignedIn() {
      await render(
        <QueryClientProvider client={new QueryClient()}>
          <AuthProvider>
            <SignOutProbe />
          </AuthProvider>
        </QueryClientProvider>,
      );
      await waitFor(() =>
        expect(screen.getByTestId("status")).toHaveTextContent("signedIn"),
      );
    }
    const signedOut = () =>
      waitFor(() =>
        expect(screen.getByTestId("status")).toHaveTextContent("signedOut"),
      );

    beforeEach(() => {
      mockClearFiles.mockReset();
      mockDeleteItem.mockClear();
    });

    it.each(["sign-out", "delete"])(
      "clears the downloaded files and the remembered project (%s)",
      async (button) => {
        await renderSignedIn();
        await fireEvent.press(screen.getByTestId(button));
        await signedOut();
        expect(mockClearFiles).toHaveBeenCalledTimes(1);
        expect(mockDeleteItem).toHaveBeenCalledWith("folio.dashboard.project");
        expect(mockDeleteItem).toHaveBeenCalledWith(
          "folio.billing.lastCompany.devis",
        );
        expect(mockDeleteItem).toHaveBeenCalledWith(
          "folio.billing.lastCompany.facture",
        );
      },
    );

    it("does not wait for a key deletion that never settles, nor for one that throws", async () => {
      mockDeleteItem.mockImplementationOnce(() => new Promise(() => undefined));
      mockDeleteItem.mockImplementationOnce(() => {
        throw new Error("sync failure");
      });
      await renderSignedIn();
      await fireEvent.press(screen.getByTestId("sign-out"));
      await signedOut();
    });

    it("signs out even when the file cleanup or the key deletion fails", async () => {
      mockClearFiles.mockImplementation(() => {
        throw new Error("EBUSY");
      });
      mockDeleteItem.mockRejectedValueOnce(new Error("keychain locked"));
      await renderSignedIn();
      await fireEvent.press(screen.getByTestId("sign-out"));
      await signedOut();
      expect(mockClearFiles).toHaveBeenCalled();
    });
  });
});
