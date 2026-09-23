/**
 * `ChatScreen`'s channel chip row: the `admin` kind gets a lock icon and the "Quản trị" /
 * "Administration" label instead of its own name, and its header subtitle names the admin
 * scope — the assistant no longer pins a channel of its own (see `chat-mention.test.ts` and
 * `chat-assistant-cards.test.tsx` for the mention/renderer behaviour).
 */
import { render, screen } from "@testing-library/react-native";
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
    id: "ch-admin",
    key: "admin:c1",
    kind: "admin",
    last_message_at: null,
    member_count: 2,
    name: "AVN Construction",
    unread_count: 0,
  },
];

jest.mock("@/features/chat/chat-api", () => ({
  useChatEnabled: () => true,
  useAssistantEnabled: () => true,
  useFeatures: () => ({
    data: { chat: true, assistant: true },
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

describe("ChatScreen admin channel chip", () => {
  beforeEach(() => {
    mockParams = {};
  });

  it("shows the lock icon and the admin label instead of the channel's own name", async () => {
    await i18n.changeLanguage("vi");
    await renderChatScreen();

    expect(screen.getByTestId("chat-channel-admin:c1-lock")).toBeTruthy();
    expect(screen.getByText("Quản trị")).toBeTruthy();
    // The company channel keeps its own name and no lock.
    expect(screen.queryByTestId("chat-channel-company:c1-lock")).toBeNull();
  });

  it("names the admin scope in the header subtitle once the admin channel is selected", async () => {
    mockParams = { channel: "admin:c1" };
    await i18n.changeLanguage("en");
    await renderChatScreen();

    expect(screen.getByTestId("chat-title").props.children).toBe(
      "AVN Construction",
    );
    expect(
      screen.getByText("Company finance, payroll and Folio activity"),
    ).toBeTruthy();
  });
});
