/**
 * Mac #35: a cold start must not open with the OS notification permission dialog. The app
 * explains first; "Not now" is remembered, and a permission refused for good is never asked.
 */

import * as Notifications from "expo-notifications";
import { Alert } from "react-native";

import { registerPushDevice } from "@/features/push/push-device-registration";

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(
      async (key: string, value: string) => void store.set(key, value),
    ),
    deleteItemAsync: jest.fn(async (key: string) => void store.delete(key)),
    __store: store,
  };
});

jest.mock("expo-notifications", () => ({
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
  AndroidImportance: { HIGH: 4 },
}));

jest.mock("expo-device", () => ({ isDevice: false }));
jest.mock("@/api/client", () => ({ api: { POST: jest.fn() } }));

const getPermissions = Notifications.getPermissionsAsync as jest.Mock;
const requestPermissions = Notifications.requestPermissionsAsync as jest.Mock;

type Button = { text: string; onPress?: () => void };

const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

function answerPrePrompt(choice: "enable" | "later") {
  alert.mockImplementationOnce((_t, _m, buttons) => {
    const list = buttons as Button[];
    list[choice === "later" ? 0 : 1].onPress?.();
  });
}

beforeEach(() => {
  alert.mockClear();
  requestPermissions.mockClear();
  (
    jest.requireMock("expo-secure-store") as { __store: Map<string, string> }
  ).__store.clear();
});

describe("notification permission", () => {
  it("explains before the OS dialog, and asks the OS only when the user agrees", async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    answerPrePrompt("enable");

    await registerPushDevice();

    expect(alert).toHaveBeenCalledTimes(1);
    expect(requestPermissions).toHaveBeenCalledTimes(1);
  });

  it("does not open the OS dialog on 'Not now', nor explain again on the next start", async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    answerPrePrompt("later");

    await registerPushDevice();
    expect(requestPermissions).not.toHaveBeenCalled();

    alert.mockClear();
    await registerPushDevice();
    expect(alert).not.toHaveBeenCalled();
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("never asks once the permission was refused for good", async () => {
    getPermissions.mockResolvedValue({ granted: false, canAskAgain: false });

    await registerPushDevice();

    expect(alert).not.toHaveBeenCalled();
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("asks nothing when notifications are already allowed", async () => {
    getPermissions.mockResolvedValue({ granted: true, canAskAgain: true });

    await registerPushDevice();

    expect(alert).not.toHaveBeenCalled();
    expect(requestPermissions).not.toHaveBeenCalled();
  });
});
