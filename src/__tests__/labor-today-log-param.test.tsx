import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { screen, waitFor } from "@testing-library/react-native";

import "@/i18n";
import LaborTab from "../../app/(app)/(tabs)/labor";
import {
  TODAY,
  answerGet,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";
import type { Persona } from "./helpers/release-qa-fixtures";

let mockPersona: Persona = persona("manager");
let mockParams: Record<string, string | undefined> = {};
const mockSetParams = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    setParams: mockSetParams,
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: () => {},
}));

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: mockPersona.user }),
}));

jest.mock("@/components/shell/shell-context", () => {
  const fixtures = jest.requireActual("./helpers/release-qa-fixtures");
  return {
    ...jest.requireActual("@/components/shell/shell-context"),
    useShell: () => fixtures.SHELL,
  };
});

jest.mock("@/features/projects/selected-project", () => {
  const fixtures = jest.requireActual("./helpers/release-qa-fixtures");
  return { useSelectedProject: () => fixtures.selectedProject(mockPersona) };
});

const mockGet = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: jest.fn(),
    PUT: jest.fn(),
    PATCH: jest.fn(),
    DELETE: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPersona = persona("manager");
  mockGet.mockImplementation((path: string, options?: unknown) =>
    answerGet(() => mockPersona)(path, options as never),
  );
});

/** The overview's "today on site" lands on the labor tab with `day` and `log` (P-08). */
describe("labor tab · log param", () => {
  it("opens the log sheet of the given day with log=1, then drops the params", async () => {
    const present = jest.spyOn(BottomSheetModal.prototype, "present");
    mockParams = { segment: "calendar", day: TODAY, log: "1", focus: "1" };
    await renderWithProviders(<LaborTab />);

    await waitFor(() => expect(present).toHaveBeenCalledTimes(1));
    expect(mockSetParams).toHaveBeenCalledWith({
      day: undefined,
      log: undefined,
    });
    expect(
      screen.getByTestId(`calendar-day-${TODAY}`).props.accessibilityState
        .selected,
    ).toBe(true);
    present.mockRestore();
  });

  it("only selects the day without log", async () => {
    const present = jest.spyOn(BottomSheetModal.prototype, "present");
    mockParams = { segment: "calendar", day: TODAY, focus: "2" };
    await renderWithProviders(<LaborTab />);

    await screen.findByTestId(`calendar-day-${TODAY}`);
    await waitFor(() => expect(mockSetParams).toHaveBeenCalled());
    expect(present).not.toHaveBeenCalled();
    present.mockRestore();
  });
});
