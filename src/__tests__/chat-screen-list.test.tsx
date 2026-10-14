/**
 * `ChatScreen`'s Messenger-style conversation list: it opens on the list (no deep link), a row
 * opens its thread, the back arrow of a thread returns to the list, and a deep link goes
 * straight to the thread.
 */
import { fireEvent, render, screen } from "@testing-library/react-native";
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

jest.mock("@/features/chat/chat-api", () => ({
  useChatEnabled: () => true,
  useFeatures: () => ({
    data: { chat: true },
    isPending: false,
    isFetched: true,
  }),
  useChatChannels: () => ({ data: CHANNELS }),
  useChatMessages: () => ({
    data: { items: [], members: [] },
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useMarkChatRead: () => ({ mutate: jest.fn() }),
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
});
