import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import i18n from "@/i18n";
import NotificationPreferencesScreen from "../../app/(app)/(tabs)/settings/notifications";

const mockGet = jest.fn();
const mockPut = jest.fn();
jest.mock("@/api/client", () => ({
  api: {
    GET: (...args: unknown[]) => mockGet(...args),
    PUT: (...args: unknown[]) => mockPut(...args),
  },
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

const ALL_ON = {
  push_enabled: true,
  chat: true,
  attendance: true,
  tasks: true,
  membership: true,
  billing: true,
};

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

// One client per test, cleared afterwards: cached queries hold garbage-collection timers
// that otherwise keep the Jest worker alive after the run (see company-member-grants-sheet).
let queryClient: QueryClient;

async function renderScreen() {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  return await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <QueryClientProvider client={queryClient}>
        <NotificationPreferencesScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  queryClient?.clear();
});

describe("Settings → Notifications", () => {
  it("renders the master switch plus one switch per category from the server state", async () => {
    mockGet.mockResolvedValue({ data: { ...ALL_ON, chat: false } });
    await renderScreen();

    expect(await screen.findByTestId("notification-prefs")).toBeTruthy();
    expect(
      screen.getByTestId("notification-pref-push_enabled").props.value,
    ).toBe(true);
    expect(screen.getByTestId("notification-pref-chat").props.value).toBe(
      false,
    );
    expect(screen.getByTestId("notification-pref-billing").props.value).toBe(
      true,
    );
    expect(screen.getAllByRole("switch")).toHaveLength(6);
  });

  it("sends only the toggled field and keeps the server's answer", async () => {
    mockGet.mockResolvedValue({ data: ALL_ON });
    mockPut.mockResolvedValue({ data: { ...ALL_ON, tasks: false } });
    await renderScreen();

    const tasks = await screen.findByTestId("notification-pref-tasks");
    await act(async () => {
      fireEvent(tasks, "valueChange", false);
    });

    expect(mockPut).toHaveBeenCalledWith("/api/v1/notifications/preferences", {
      body: { tasks: false },
    });
    expect(
      (await screen.findByTestId("notification-pref-tasks")).props.value,
    ).toBe(false);
    // One GET at mount; the PUT response fed the cache, no refetch needed.
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("snaps the switch back when the save fails", async () => {
    mockGet.mockResolvedValue({ data: ALL_ON });
    mockPut.mockResolvedValue({
      error: { error: "InternalError", message: "boom" },
      response: { status: 500 },
    });
    await renderScreen();

    const billing = await screen.findByTestId("notification-pref-billing");
    await act(async () => {
      fireEvent(billing, "valueChange", false);
    });

    expect(
      (await screen.findByTestId("notification-pref-billing")).props.value,
    ).toBe(true);
  });

  it("greys out every category while the master switch is off", async () => {
    mockGet.mockResolvedValue({ data: { ...ALL_ON, push_enabled: false } });
    await renderScreen();

    await screen.findByTestId("notification-prefs");
    expect(
      screen.getByTestId("notification-pref-push_enabled").props.disabled,
    ).toBe(false);
    for (const key of [
      "chat",
      "attendance",
      "tasks",
      "membership",
      "billing",
    ]) {
      expect(
        screen.getByTestId(`notification-pref-${key}`).props.disabled,
      ).toBe(true);
    }
  });

  it("shows the load error instead of switches when the fetch fails", async () => {
    mockGet.mockResolvedValue({
      error: { error: "InternalError", message: "boom" },
      response: { status: 500 },
    });
    await renderScreen();

    expect(
      await screen.findByText(i18n.t("settings.notificationPrefs.loadError")),
    ).toBeTruthy();
    expect(screen.queryByTestId("notification-prefs")).toBeNull();
  });
});
