/**
 * A confirmed phone change signs the account out of every other device and revokes the
 * tokens this session used; the backend answers with a fresh pair. The app must store that
 * pair, or its next request (or refresh) is refused and the user is thrown out too.
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
import { setStoredTokens } from "@/auth/token-storage";

jest.mock("@/auth/token-storage", () => ({
  getStoredTokens: jest.fn(async () => ({
    accessToken: "old-access",
    refreshToken: "old-refresh",
  })),
  setStoredTokens: jest.fn(async () => undefined),
  clearStoredTokens: jest.fn(async () => undefined),
}));

jest.mock("@/features/push/push-device-registration", () => ({
  unregisterPushDevice: jest.fn(async () => undefined),
}));

const ME = {
  id: "u1",
  email: "me@example.com",
  permissions: [],
  phone: "+33611111111",
  companies: [{ id: "c1", legal_name: "Folio Demo SARL", role: "admin" }],
};

const mockPost = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: jest.fn(async () => ({ data: ME })),
    POST: (...args: unknown[]) => mockPost(...args),
  },
  refreshAccessToken: jest.fn(async () => "new-access-token"),
  setSessionExpiredHandler: jest.fn(),
}));

function ConfirmProbe() {
  const { status, user, confirmPhoneChange } = useAuth();
  return (
    <Pressable
      testID="confirm"
      onPress={() => void confirmPhoneChange("+33622222222", "482917")}
    >
      <Text testID="status">{status}</Text>
      <Text testID="phone">{user?.phone ?? ""}</Text>
    </Pressable>
  );
}

describe("confirming a phone change", () => {
  it("keeps the session with the fresh tokens the change answers with", async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        ...ME,
        phone: "+33622222222",
        access_token: "fresh-access",
        refresh_token: "fresh-refresh",
      },
      response: { ok: true, status: 200 },
    });

    await render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <ConfirmProbe />
        </AuthProvider>
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("signedIn"),
    );

    await fireEvent.press(screen.getByTestId("confirm"));

    await waitFor(() =>
      expect(screen.getByTestId("phone")).toHaveTextContent("+33622222222"),
    );
    expect(mockPost).toHaveBeenCalledWith("/api/v1/auth/me/phone/confirm", {
      body: { phone: "+33622222222", code: "482917" },
    });
    expect(setStoredTokens).toHaveBeenCalledWith(
      "fresh-access",
      "fresh-refresh",
    );
    expect(screen.getByTestId("status")).toHaveTextContent("signedIn");
  });
});
