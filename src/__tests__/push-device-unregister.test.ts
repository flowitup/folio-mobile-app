/**
 * Sign-out has to stop the leaving account's pushes on this phone. When DELETE /push/devices
 * never reaches the backend (offline) or fails, the server row stays tied to that account, so
 * the install must stop OS delivery itself instead of silently dropping its local token.
 */

import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";

import { unregisterPushDevice } from "@/features/push/push-device-registration";

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(
      async (key: string, value: string) => void store.set(key, value),
    ),
    deleteItemAsync: jest.fn(async (key: string) => void store.delete(key)),
  };
});

jest.mock("expo-notifications", () => ({
  unregisterForNotificationsAsync: jest.fn(async () => undefined),
}));

const mockDelete = jest.fn();
jest.mock("@/api/client", () => ({
  api: { DELETE: (...args: unknown[]) => mockDelete(...args) },
}));

const TOKEN_KEY = "folio.push.token";
const TOKEN = "ExponentPushToken[leaving-device]";

describe("unregisterPushDevice", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await SecureStore.setItemAsync(TOKEN_KEY, TOKEN);
  });

  it("forgets the token server-side and keeps OS delivery when the backend answers", async () => {
    mockDelete.mockResolvedValue({ response: { ok: true, status: 204 } });

    await unregisterPushDevice();

    expect(mockDelete).toHaveBeenCalledWith("/api/v1/push/devices", {
      body: { token: TOKEN },
    });
    expect(
      Notifications.unregisterForNotificationsAsync,
    ).not.toHaveBeenCalled();
    expect(await SecureStore.getItemAsync(TOKEN_KEY)).toBeNull();
  });

  it("stops OS delivery when the request cannot reach the backend (offline)", async () => {
    mockDelete.mockRejectedValue(new TypeError("Network request failed"));

    await unregisterPushDevice();

    expect(Notifications.unregisterForNotificationsAsync).toHaveBeenCalledTimes(
      1,
    );
    expect(await SecureStore.getItemAsync(TOKEN_KEY)).toBeNull();
  });

  it("stops OS delivery when the backend refuses to forget the token", async () => {
    mockDelete.mockResolvedValue({ response: { ok: false, status: 500 } });

    await unregisterPushDevice();

    expect(Notifications.unregisterForNotificationsAsync).toHaveBeenCalledTimes(
      1,
    );
    expect(await SecureStore.getItemAsync(TOKEN_KEY)).toBeNull();
  });

  it("does nothing when this install never registered a token", async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);

    await unregisterPushDevice();

    expect(mockDelete).not.toHaveBeenCalled();
    expect(
      Notifications.unregisterForNotificationsAsync,
    ).not.toHaveBeenCalled();
  });
});
