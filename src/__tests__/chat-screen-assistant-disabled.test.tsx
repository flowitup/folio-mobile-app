/**
 * End-to-end gating for `features.assistant`: with the flag off, `ChatScreen` never shows an
 * `@folio` composer suggestion or the "Ask again" reply button under an assistant message —
 * the backend answers either with 404 `FeatureDisabled`, so both stay hidden instead of
 * dead-ending there.
 */
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import i18n from "@/i18n";

import ChatScreen from "../../app/(app)/chat";

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

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
    navigate: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

const CHANNEL = {
  id: "ch-company",
  key: "company:c1",
  kind: "company",
  last_message_at: null,
  member_count: 3,
  name: "AVN Construction",
  unread_count: 0,
};

const ASSISTANT_MESSAGE = {
  id: "assistant-1",
  channel_key: "company:c1",
  sender_id: null,
  sender_name: "Folio",
  body: "Bonjour, comment puis-je aider ?",
  attachment: null,
  created_at: "2026-09-21T10:00:00+00:00",
  mine: false,
  sender_type: "assistant",
  content_type: "text",
  payload: null,
  reply_to_id: null,
};

jest.mock("@/features/chat/chat-api", () => ({
  useChatEnabled: () => true,
  // Chat itself is on, but the assistant flag is off (or the deployment has no key set) —
  // the scenario this gate exists for.
  useAssistantEnabled: () => false,
  useFeatures: () => ({
    data: { chat: true, assistant: false },
    isPending: false,
    isFetched: true,
  }),
  useChatChannels: () => ({ data: [CHANNEL] }),
  useChatMessages: () => ({
    data: { items: [ASSISTANT_MESSAGE], members: [] },
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

describe("ChatScreen with the assistant feature off", () => {
  it("never shows the reply button under an existing assistant message", async () => {
    await i18n.changeLanguage("en");
    await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <ChatScreen />
      </SafeAreaProvider>,
    );

    expect(screen.queryByTestId("chat-reply-assistant")).toBeNull();
  });

  it("never suggests @folio while the reader types an @-token", async () => {
    await i18n.changeLanguage("en");
    await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <ChatScreen />
      </SafeAreaProvider>,
    );

    await fireEvent.changeText(screen.getByTestId("chat-input"), "hey @fo");

    expect(screen.queryByTestId("chat-mention-suggestion")).toBeNull();
  });
});
