/**
 * Moving the account to a new sign-in number (Account sheet → Phone number).
 *
 * The code goes to the NEW number and the number only changes once that code comes back;
 * a refused number, a wrong code and the current number all explain themselves and change
 * nothing. The sign-in code boxes auto-submit at six digits here too, and a rejected code is
 * never re-sent unchanged (each try spends one of the backend's five attempts).
 */

import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import { ChangePhoneForm } from "@/components/account/change-phone-form";
import { AccountSheet } from "@/components/shell/account-sheet";
import { ShellProvider, useShell } from "@/components/shell/shell-context";
import i18n from "@/i18n";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const mockRequestCode = jest.fn();
const mockConfirm = jest.fn();
jest.mock("@/auth/auth-context", () => ({
  AccountDeletionBlockedError: class extends Error {},
  useAuth: () => ({
    user: {
      id: "u1",
      email: "chef@example.com",
      display_name: "Chef",
      phone: "+33611111111",
      permissions: [],
      companies: [],
    },
    requestPhoneChangeCode: (...args: unknown[]) => mockRequestCode(...args),
    confirmPhoneChange: (...args: unknown[]) => mockConfirm(...args),
    signOut: jest.fn(),
    deleteAccount: jest.fn(),
  }),
}));

const mockShowToast = jest.fn();
jest.mock("@/components/ui/toast", () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => "/",
}));

const t = (key: string, values?: Record<string, unknown>) =>
  i18n.t(key, values) as string;

async function renderForm(onDone = jest.fn()) {
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <ChangePhoneForm onDone={onDone} />
    </SafeAreaProvider>,
  );
  return onDone;
}

async function sendCodeTo(number: string) {
  const user = userEvent.setup();
  await user.type(screen.getByTestId("change-phone-input"), number);
  await user.press(screen.getByTestId("change-phone-send"));
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  mockRequestCode.mockReset().mockResolvedValue(300);
  mockConfirm.mockReset().mockResolvedValue(undefined);
  mockShowToast.mockReset();
  mockPush.mockReset();
});

describe("ChangePhoneForm", () => {
  it("texts the code to the new number, then confirms it and finishes", async () => {
    const onDone = await renderForm();

    await sendCodeTo("6 22 22 22 22");
    expect(mockRequestCode).toHaveBeenCalledWith("+33622222222");
    expect(
      await screen.findByText(
        t("account.phone.codeSentTo", { phone: "+33622222222" }),
      ),
    ).toBeTruthy();

    // Six digits auto-submit, exactly as on sign-in.
    await fireEvent.changeText(
      screen.getByTestId("change-phone-code-0"),
      "482917",
    );

    await waitFor(() =>
      expect(mockConfirm).toHaveBeenCalledWith("+33622222222", "482917"),
    );
    expect(mockShowToast).toHaveBeenCalledWith(
      t("account.phone.changed"),
      "success",
    );
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("refuses a foreign number before asking the server", async () => {
    await renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByTestId("change-phone-input"), "+84912345678");

    expect(screen.getByTestId("change-phone-send")).toBeDisabled();
    expect(mockRequestCode).not.toHaveBeenCalled();
  });

  it("does not text the number the account already uses", async () => {
    await renderForm();

    await sendCodeTo("0611111111");

    expect(mockRequestCode).not.toHaveBeenCalled();
    expect(screen.getByTestId("change-phone-error")).toHaveTextContent(
      new RegExp(t("account.phone.errors.sameNumber")),
    );
  });

  it("explains a number taken by another account and stays on the first step", async () => {
    mockRequestCode.mockRejectedValueOnce(
      new Error(t("account.phone.errors.phoneTaken")),
    );
    await renderForm();

    await sendCodeTo("0622222222");

    expect(screen.getByTestId("change-phone-error")).toHaveTextContent(
      new RegExp(t("account.phone.errors.phoneTaken")),
    );
    expect(screen.getByTestId("change-phone-step-number")).toBeTruthy();
  });

  it("keeps the old number on a wrong code and never re-sends that code", async () => {
    mockConfirm.mockRejectedValueOnce(new Error(t("login.errors.invalidCode")));
    const onDone = await renderForm();

    await sendCodeTo("0622222222");
    await fireEvent.changeText(
      await screen.findByTestId("change-phone-code-0"),
      "000000",
    );

    await waitFor(() =>
      expect(screen.getByTestId("change-phone-error")).toHaveTextContent(
        new RegExp(t("login.errors.invalidCode")),
      ),
    );
    expect(screen.getByTestId("change-phone-confirm")).toBeDisabled();
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("goes back to the number step to try another number", async () => {
    await renderForm();

    await sendCodeTo("0622222222");
    await fireEvent.press(
      await screen.findByTestId("change-phone-other-number"),
    );

    expect(screen.getByTestId("change-phone-step-number")).toBeTruthy();
  });
});

function OpenAccount() {
  const { openSheet } = useShell();
  return (
    <Pressable testID="open-account" onPress={() => openSheet("account")}>
      <Text>open</Text>
    </Pressable>
  );
}

describe("AccountSheet — phone number", () => {
  it("shows the sign-in number and opens the change screen", async () => {
    await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <ShellProvider>
          <OpenAccount />
          <AccountSheet />
        </ShellProvider>
      </SafeAreaProvider>,
    );
    await fireEvent.press(screen.getByTestId("open-account"));

    expect(screen.getByTestId("account-phone")).toHaveTextContent(
      /\+33611111111/,
    );
    await fireEvent.press(screen.getByTestId("account-phone"));
    expect(mockPush).toHaveBeenCalledWith("/settings/phone");
  });
});
