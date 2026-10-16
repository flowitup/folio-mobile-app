import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import LaborTab from "../../app/(app)/(tabs)/labor";
import type { Worker } from "@/features/labor/labor-types";
import { formatMoney } from "@/lib/format/money";
import {
  WORKER_MINH,
  WORKER_TUAN,
  answerGet,
  containing,
  ok,
  persona,
  renderWithProviders,
} from "./helpers/release-qa-fixtures";
import type { Persona } from "./helpers/release-qa-fixtures";

/**
 * A stopped (deactivated) worker can still be owed pay: the labor tab asks for inactive workers
 * too, so their unpaid days stay in Payments and the card offers Reactivate instead of vanishing.
 */
const mockPersona: Persona = persona("admin");
let mockParams: { segment?: string } = {};
const STOPPED: Worker = { ...WORKER_TUAN, is_active: false };

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => mockParams,
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
  jest.clearAllMocks();
  mockGet.mockImplementation((path: string, options?: unknown) => {
    if (path === "/api/v1/projects/{project_id}/workers") {
      // Same rule as the API: stopped workers only with include_inactive=true.
      const query = (options as { params?: { query?: Record<string, string> } })
        ?.params?.query;
      return Promise.resolve(
        ok({
          workers:
            query?.include_inactive === "true"
              ? [WORKER_MINH, STOPPED]
              : [WORKER_MINH],
        }),
      );
    }
    return answerGet(() => mockPersona)(path, options as never);
  });
  mockPut.mockResolvedValue(ok({ ...STOPPED, is_active: true }));
});

describe("labor tab · stopped worker", () => {
  it("keeps the pay owed to a stopped worker in Payments", async () => {
    mockParams = { segment: "payments" };
    await renderWithProviders(<LaborTab />);

    expect(
      await screen.findByTestId(`payment-record-${STOPPED.id}`),
    ).toBeTruthy();
    expect(screen.getByTestId("payment-record-all")).toHaveTextContent(
      containing(formatMoney(230)),
    );
  });

  it("lists the stopped worker and reactivates them from their card", async () => {
    mockParams = { segment: "workers" };
    await renderWithProviders(<LaborTab />);

    await fireEvent.press(
      await screen.findByTestId(`worker-card-${STOPPED.id}`),
    );
    expect(screen.queryByTestId(`worker-delete-${STOPPED.id}`)).toBeNull();
    await fireEvent.press(
      await screen.findByTestId(`worker-reactivate-${STOPPED.id}`),
    );
    await waitFor(() => expect(mockPut).toHaveBeenCalled());
    expect(mockPut.mock.calls[0][1]).toMatchObject({
      params: { path: { worker_id: STOPPED.id } },
      body: { is_active: true },
    });
  });
});
