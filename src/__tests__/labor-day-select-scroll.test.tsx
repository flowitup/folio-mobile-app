import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { ScrollView } from "react-native";

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

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => ({}),
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

/**
 * The day card renders under the month grid, below the fold on a phone. Tapping a day has to
 * bring the grid (and the card right after it) into view, or the tap changes nothing visible.
 */
describe("labor tab day selection", () => {
  it("scrolls the calendar to the top of the viewport when a day is tapped", async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo");
    await renderWithProviders(<LaborTab />);

    const block = await screen.findByTestId("attendance-calendar-block");
    fireEvent(block, "layout", {
      nativeEvent: { layout: { x: 0, y: 300, width: 360, height: 340 } },
    });
    expect(scrollTo).not.toHaveBeenCalled();

    const target = `${TODAY.slice(0, 8)}01`;
    fireEvent.press(screen.getByTestId(`calendar-day-${target}`));

    expect(scrollTo).toHaveBeenCalledWith({ y: 292, animated: true });
    await waitFor(() =>
      expect(
        screen.getByTestId(`calendar-day-${target}`).props.accessibilityState
          .selected,
      ).toBe(true),
    );
  });
});
