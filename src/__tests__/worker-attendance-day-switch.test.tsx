import { fireEvent, screen } from "@testing-library/react-native";

import { WorkerAttendanceTab } from "@/features/labor/worker-attendance-tab";
import { formatDate } from "@/lib/format/date";
import {
  ENTRIES,
  ENTRY_MINH_PENDING,
  WORKED_DAY_A,
  answerGet,
  containing,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";

/**
 * Worker mode: tapping a row of "Days this month" moved the open edit form to that day with the
 * previous day's draft, so "Send request" filed the correction on the wrong day. A row tap now
 * selects the day like the calendar does, which closes the form.
 */
const mockPersona = persona("member");

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => undefined,
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
const mockPut = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    POST: jest.fn(),
    PUT: (...args: unknown[]) => mockPut(...args),
    PATCH: jest.fn(),
    DELETE: jest.fn(),
  },
}));

beforeEach(() => {
  mockGet.mockImplementation((path: string, options?: unknown) =>
    answerGet(() => mockPersona, { entries: ENTRIES })(path, options as never),
  );
});

it("closes the edit form when another day is picked from the month list", async () => {
  await renderWithProviders(<WorkerAttendanceTab />);

  await fireEvent.press(await screen.findByTestId("worker-edit-open"));
  await fireEvent.changeText(
    screen.getByTestId("worker-edit-note"),
    "parti à midi",
  );
  expect(ENTRY_MINH_PENDING.date).not.toBe(WORKED_DAY_A);

  await fireEvent.press(screen.getByTestId("worker-entry-e-minh-1"));

  expect(screen.queryByTestId("worker-edit-note")).toBeNull();
  expect(screen.queryByTestId("worker-edit-submit")).toBeNull();
  expect(screen.getByTestId("worker-log-card")).toHaveTextContent(
    containing(formatDate(WORKED_DAY_A)),
  );
  expect(mockPut).not.toHaveBeenCalled();
});
