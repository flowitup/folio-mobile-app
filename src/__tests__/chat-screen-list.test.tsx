/**
 * `ChatScreen`'s Messenger-style conversation list: it opens on the list (no deep link), a row
 * opens its thread, the back arrow of a thread returns to the list, and a deep link goes
 * straight to the thread.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import i18n from "@/i18n";

import ChatScreen from "../../app/(app)/chat";

// A native module; the composer's voice recorder hook calls into it unconditionally on mount.
jest.mock("expo-audio", () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  AudioModule: {
    requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })),
  },
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: () => ({
    isRecording: false,
    uri: null,
    prepareToRecordAsync: jest.fn(async () => undefined),
    record: jest.fn(),
    stop: jest.fn(async () => undefined),
  }),
  useAudioRecorderState: () => ({ isRecording: false, durationMillis: 0 }),
  useAudioPlayer: () => ({
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
  }),
  useAudioPlayerStatus: () => ({
    isLoaded: false,
    playing: false,
    currentTime: 0,
    duration: 0,
    didJustFinish: false,
  }),
}));

jest.mock("@/lib/files/pick", () => ({
  pickImages: jest.fn(async () => ({ status: "canceled" })),
  captureImage: jest.fn(async () => ({ status: "canceled" })),
}));

let mockParams: { channel?: string } = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
    navigate: jest.fn(),
  }),
  useLocalSearchParams: () => mockParams,
}));

let mockPreventRemove: { prevent: boolean; callback: () => void } | null = null;
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: (prevent: boolean, callback: () => void) => {
    mockPreventRemove = { prevent, callback };
  },
}));

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

const mockToast = jest.fn();
jest.mock("@/components/ui/toast", () => ({
  showToast: (...args: unknown[]) => mockToast(...args),
}));

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

const CHANNELS = [
  {
    id: "ch-company",
    key: "company:c1",
    kind: "company",
    last_message_at: null,
    member_count: 3,
    name: "AVN Construction",
    unread_count: 0,
  },
  {
    id: "ch-project",
    key: "project:p1",
    kind: "project",
    last_message_at: null,
    member_count: 2,
    name: "Nhà 13",
    unread_count: 1,
  },
];

const mockMessagesKeys: (string | null)[] = [];
const mockMarkRead = jest.fn();
const mockRefetchChannels = jest.fn();
jest.mock("@/features/chat/chat-api", () => ({
  CHAT_PAGE_SIZE: 100,
  CHAT_OLDER_PAGE_SIZE: 50,
  CHAT_MAX_BODY_LENGTH: 4000,
  chatKeys: { channels: ["chat", "channels"] },
  fetchChatMessages: jest.fn(),
  useChatEnabled: () => true,
  useFeatures: () => ({
    data: { chat: true },
    isPending: false,
    isFetched: true,
  }),
  useChatChannels: () => ({
    data: CHANNELS,
    isSuccess: true,
    isError: false,
    refetch: mockRefetchChannels,
  }),
  useChatMessages: (key: string | null) => {
    mockMessagesKeys.push(key);
    return {
      data: key ? { items: [], members: [] } : undefined,
      isPending: !key,
      isError: false,
      error: null,
      refetch: jest.fn(),
    };
  },
  useMarkChatRead: () => ({ mutate: mockMarkRead }),
  useSendChatMessage: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useBlockedUsers: () => ({ data: [] }),
  useReportChatMessage: () => ({ mutate: jest.fn() }),
  useBlockChatUser: () => ({ mutate: jest.fn() }),
  useUnblockChatUser: () => ({ mutate: jest.fn() }),
  useToggleChatReaction: () => ({ mutate: jest.fn() }),
}));

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

async function renderChatScreen() {
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <ChatScreen />
    </SafeAreaProvider>,
  );
}

describe("ChatScreen conversation list", () => {
  beforeEach(() => {
    mockParams = {};
    mockMessagesKeys.length = 0;
    mockMarkRead.mockClear();
    mockToast.mockClear();
    mockPreventRemove = null;
    mockRefetchChannels.mockReset();
    mockRefetchChannels.mockResolvedValue({ data: CHANNELS });
  });

  it("neither fetches nor marks read a conversation while only the list is shown", async () => {
    await i18n.changeLanguage("fr");
    await renderChatScreen();
    expect(screen.getByTestId("chat-list-screen")).toBeTruthy();
    expect(mockMessagesKeys.every((key) => key === null)).toBe(true);
    expect(mockMarkRead).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("chat-channel-project:p1"));
    expect(mockMarkRead).toHaveBeenCalledWith({ channelKey: "project:p1" });

    // Back on the list, the closed thread is neither polled nor marked read any more.
    await fireEvent.press(screen.getByTestId("chat-close"));
    mockMarkRead.mockClear();
    mockMessagesKeys.length = 0;
    await fireEvent.press(screen.getByTestId("chat-title"));
    expect(mockMessagesKeys.every((key) => key === null)).toBe(true);
    expect(mockMarkRead).not.toHaveBeenCalled();
  });

  it("turns the system back (Android button, iOS gesture) in a thread into 'back to the list'", async () => {
    await i18n.changeLanguage("en");
    await renderChatScreen();
    expect(mockPreventRemove?.prevent).toBe(false);
    await fireEvent.press(screen.getByTestId("chat-channel-project:p1"));
    expect(mockPreventRemove?.prevent).toBe(true);
    await act(async () => mockPreventRemove?.callback());
    expect(screen.getByTestId("chat-list-screen")).toBeTruthy();
    expect(mockPreventRemove?.prevent).toBe(false);
  });

  it("says a linked conversation is no longer available instead of opening another one", async () => {
    mockParams = { channel: "project:gone" };
    await i18n.changeLanguage("en");
    await renderChatScreen();
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "You no longer have access to this conversation.",
        "error",
      ),
    );
    expect(mockRefetchChannels).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("chat-list-screen")).toBeTruthy();
    expect(mockMessagesKeys).not.toContain("company:c1");
  });

  it("opens on the list, opens a thread from a row and comes back with the back arrow", async () => {
    await i18n.changeLanguage("vi");
    await renderChatScreen();

    expect(screen.getByTestId("chat-list-screen")).toBeTruthy();
    expect(screen.getByText("Nhà 13")).toBeTruthy();
    expect(screen.getByTestId("chat-unread-project:p1")).toBeTruthy();
    expect(screen.queryByTestId("chat-input")).toBeNull();

    await fireEvent.press(screen.getByTestId("chat-channel-project:p1"));
    expect(screen.queryByTestId("chat-list-screen")).toBeNull();
    expect(screen.getByTestId("chat-title").props.children).toBe("Nhà 13");
    expect(screen.getByTestId("chat-input")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("chat-close"));
    expect(screen.getByTestId("chat-list-screen")).toBeTruthy();
  });

  it("goes straight to the thread with a deep link", async () => {
    mockParams = { channel: "project:p1" };
    await i18n.changeLanguage("en");
    await renderChatScreen();

    expect(screen.queryByTestId("chat-list-screen")).toBeNull();
    expect(screen.getByTestId("chat-title").props.children).toBe("Nhà 13");
  });

  it("follows a new deep link while the chat is already open", async () => {
    mockParams = { channel: "company:c1" };
    await i18n.changeLanguage("en");
    const tree = () => (
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <ChatScreen />
      </SafeAreaProvider>
    );
    const view = await render(tree());
    expect(screen.getByTestId("chat-title").props.children).toBe(
      "AVN Construction",
    );

    // A push for another conversation is tapped: same screen, new `channel` param.
    mockParams = { channel: "project:p1" };
    await view.rerender(tree());
    expect(screen.getByTestId("chat-title").props.children).toBe("Nhà 13");
  });
});
