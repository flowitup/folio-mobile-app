/**
 * Changing the app language re-sends the push registration so pushes come in the new language.
 * It must never show the system permission prompt again to someone who declined notifications.
 */

import * as Notifications from "expo-notifications";

import { registerPushDevice } from "@/features/push/push-device-registration";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-device", () => ({ isDevice: false }));

jest.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4 },
  setNotificationChannelAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
}));

jest.mock("@/api/client", () => ({ api: { POST: jest.fn() } }));

// The app's own explanation comes first (auth-onboarding): the user accepts it here.
jest.mock("@/features/push/push-pre-prompt", () => ({
  confirmPushPrePrompt: jest.fn(async () => true),
}));

describe("registerPushDevice", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does not ask for permission again when only refreshing (language change)", async () => {
    await expect(registerPushDevice({ ask: false })).resolves.toBeNull();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("asks for permission on the first registration", async () => {
    await expect(registerPushDevice()).resolves.toBeNull();
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});
