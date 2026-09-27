import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import i18n from "@/i18n";
import UsersScreen from "../../app/(app)/(tabs)/settings/users";

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const USER = {
  id: "u1",
  email: "manager.alice@example.com",
  display_name: "Alice Manager",
  phone: "+33600000003",
};

const mockMutate = jest.fn();
jest.mock("@/features/admin/admin-api", () => ({
  useAdminUserSearch: () => ({ data: [USER], isFetching: false }),
  useUpdateUser: () => ({ mutate: mockMutate, isPending: false }),
}));

const mockShowToast = jest.fn();
jest.mock("@/components/ui/toast", () => ({
  ...jest.requireActual("@/components/ui/toast"),
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true }),
}));

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: { id: "ops", is_platform_ops: true } }),
}));

beforeEach(() => jest.clearAllMocks());

async function openEditor() {
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <UsersScreen />
    </SafeAreaProvider>,
  );
  await fireEvent.changeText(screen.getByTestId("user-search"), "alice");
  await waitFor(() => screen.getByTestId(`user-pick-${USER.id}`));
  await fireEvent.press(screen.getByTestId(`user-pick-${USER.id}`));
  await fireEvent.press(screen.getByTestId("user-edit"));
}

/**
 * Sign-in is French-only. Letting the server reject the number raised its own English
 * sentence — "Invalid phone number" — in a toast over an otherwise translated screen.
 */
describe("editing a user's sign-in number", () => {
  it("refuses a number that is not French, in the user's language", async () => {
    await openEditor();

    await fireEvent.changeText(screen.getByTestId("user-edit-phone"), "123");
    await fireEvent.press(screen.getByTestId("user-edit-submit"));

    expect(mockMutate).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(
      i18n.t("login.invalidPhone"),
      "error",
    );
  });

  it("saves a French number in E.164, however the user spaced it", async () => {
    await openEditor();

    await fireEvent.changeText(
      screen.getByTestId("user-edit-phone"),
      "06 99 88 77 66",
    );
    await fireEvent.press(screen.getByTestId("user-edit-submit"));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0][0].phone).toBe("+33699887766");
  });

  it("clears the number when the field is emptied", async () => {
    await openEditor();

    await fireEvent.changeText(screen.getByTestId("user-edit-phone"), "  ");
    await fireEvent.press(screen.getByTestId("user-edit-submit"));

    expect(mockMutate.mock.calls[0][0].phone).toBeNull();
  });
});
