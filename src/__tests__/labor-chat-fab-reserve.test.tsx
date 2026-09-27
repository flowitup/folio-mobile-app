import { screen } from "@testing-library/react-native";

import "@/i18n";
import LaborTab from "../../app/(app)/(tabs)/labor";
import { CHAT_FAB_RESERVE } from "@/components/shell/chat-fab";
import {
  answerGet,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";
import type { Persona } from "./helpers/release-qa-fixtures";

let mockPersona: Persona = persona("manager");
let mockChat = false;

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
    answerGet(() => mockPersona, { chat: mockChat })(path, options as never),
  );
});

function paddingBottomOf(testID: string): number {
  const style = screen.getByTestId(testID).props.contentContainerStyle;
  const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
  return flat.paddingBottom;
}

/**
 * The chat button floats over this tab and is mounted after the screen, so anything left
 * underneath it takes its taps instead: before this, the export button was reachable only
 * on its left half.
 */
describe("labor tab bottom inset", () => {
  it("reserves room for the chat button when the server enables chat", async () => {
    mockChat = true;
    await renderWithProviders(<LaborTab />);

    expect(await screen.findByTestId("labor-title")).toBeTruthy();
    expect(paddingBottomOf("labor-scroll")).toBe(CHAT_FAB_RESERVE);
  });

  it("keeps the plain inset when chat is off and no button floats there", async () => {
    mockChat = false;
    await renderWithProviders(<LaborTab />);

    expect(await screen.findByTestId("labor-title")).toBeTruthy();
    expect(paddingBottomOf("labor-scroll")).toBeLessThan(CHAT_FAB_RESERVE);
  });
});
