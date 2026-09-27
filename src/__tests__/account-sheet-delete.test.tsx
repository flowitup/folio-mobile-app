/**
 * App Store guideline 5.1.1(v) requires an in-app way to delete the account, and the
 * reviewer follows it on screen — so what is asserted here is the path a reviewer
 * takes: the entry point is visible on the account sheet, it always confirms before
 * anything is sent, cancelling sends nothing, and the last-admin refusal explains
 * itself instead of failing silently.
 *
 * `fireEvent` is awaited throughout: on React Native Testing Library 14 it resolves
 * asynchronously, and without the await the state update never lands.
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Alert, Pressable, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import { AccountDeletionBlockedError } from "@/auth/auth-context";
import { AccountSheet } from "@/components/shell/account-sheet";
import { ShellProvider, useShell } from "@/components/shell/shell-context";
import i18n from "@/i18n";

const mockDeleteAccount = jest.fn();
const mockSignOut = jest.fn();

jest.mock("@/auth/auth-context", () => {
  class AccountDeletionBlockedError extends Error {
    readonly companyName: string;
    constructor(companyName: string) {
      super(`Last administrator of ${companyName}`);
      this.name = "AccountDeletionBlockedError";
      this.companyName = companyName;
    }
  }
  return {
    AccountDeletionBlockedError,
    useAuth: () => ({
      user: {
        id: "u1",
        email: "chef@example.com",
        display_name: "Chef",
        permissions: [],
        companies: [],
      },
      signOut: mockSignOut,
      deleteAccount: mockDeleteAccount,
    }),
  };
});

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function OpenAccount() {
  const { openSheet } = useShell();
  return (
    <Pressable testID="open-account" onPress={() => openSheet("account")}>
      <Text>open</Text>
    </Pressable>
  );
}

async function renderSheet(locale = "en") {
  await i18n.changeLanguage(locale);
  // RNTL 14 resolves `render` asynchronously here — without the await the tree
  // is not mounted yet and `screen` is still detached.
  const utils = await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <ShellProvider>
        <OpenAccount />
        <AccountSheet />
      </ShellProvider>
    </SafeAreaProvider>,
  );
  await fireEvent.press(screen.getByTestId("open-account"));
  return utils;
}

/** Run the button the confirmation dialog labelled with `label`.
 *
 * Wrapped in `act` because the handler flips the sheet's deleting state, and an
 * un-acted update makes the assertions race the re-render. */
async function pressDialogButton(label: string) {
  const [, , buttons] = (Alert.alert as jest.Mock).mock.calls.at(-1) ?? [];
  const button = (buttons ?? []).find(
    (candidate: { text?: string }) => candidate.text === label,
  );
  expect(button).toBeDefined();
  await act(async () => {
    await button.onPress?.();
  });
}

describe("AccountSheet — delete my account", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  it("offers the entry point the reviewer has to find", async () => {
    await renderSheet();

    expect(screen.getByTestId("account-delete")).toBeTruthy();
    expect(screen.getByText(i18n.t("account.delete.title"))).toBeTruthy();
  });

  it("shows it in French as 'Supprimer mon compte'", async () => {
    await renderSheet("fr");

    expect(screen.getByText("Supprimer mon compte")).toBeTruthy();
  });

  it("never deletes on the first tap — it asks first", async () => {
    await renderSheet();

    await fireEvent.press(screen.getByTestId("account-delete"));

    expect(Alert.alert).toHaveBeenCalledWith(
      i18n.t("account.delete.confirmTitle"),
      i18n.t("account.delete.confirmBody"),
      expect.any(Array),
      expect.any(Object),
    );
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it("sends nothing when the confirmation is cancelled", async () => {
    await renderSheet();

    await fireEvent.press(screen.getByTestId("account-delete"));
    await pressDialogButton(i18n.t("account.delete.cancel"));

    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it("deletes once the confirmation is accepted", async () => {
    mockDeleteAccount.mockResolvedValueOnce(undefined);
    await renderSheet();

    await fireEvent.press(screen.getByTestId("account-delete"));
    await pressDialogButton(i18n.t("account.delete.confirm"));

    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledTimes(1));
  });

  it("explains which company still needs an administrator", async () => {
    mockDeleteAccount.mockRejectedValueOnce(
      new AccountDeletionBlockedError("Maçonnerie Martin"),
    );
    await renderSheet();

    await fireEvent.press(screen.getByTestId("account-delete"));
    await pressDialogButton(i18n.t("account.delete.confirm"));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        i18n.t("account.delete.blockedTitle"),
        i18n.t("account.delete.blockedBody", { company: "Maçonnerie Martin" }),
        expect.any(Array),
      ),
    );
    expect((Alert.alert as jest.Mock).mock.calls.at(-1)?.[1]).toContain(
      "Maçonnerie Martin",
    );
  });

  it("reports an ordinary failure instead of pretending it worked", async () => {
    mockDeleteAccount.mockRejectedValueOnce(new Error("network"));
    await renderSheet();

    await fireEvent.press(screen.getByTestId("account-delete"));
    await pressDialogButton(i18n.t("account.delete.confirm"));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        i18n.t("account.delete.failed"),
        undefined,
        expect.any(Array),
      ),
    );
  });

  it("re-enables the button after a failure so the user can retry", async () => {
    mockDeleteAccount.mockRejectedValueOnce(new Error("network"));
    await renderSheet();

    await fireEvent.press(screen.getByTestId("account-delete"));
    await pressDialogButton(i18n.t("account.delete.confirm"));

    await waitFor(() =>
      expect(
        screen.getByTestId("account-delete").props.accessibilityState,
      ).toEqual(expect.objectContaining({ disabled: false })),
    );
  });
});
