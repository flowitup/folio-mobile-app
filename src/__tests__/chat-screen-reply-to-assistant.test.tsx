/**
 * "Hỏi tiếp": tapping it under an assistant message shows a dismissible reply bar above the
 * composer, and the next send carries that message's id as `replyToId` — the way a reader can
 * address the assistant again without retyping `@folio`.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
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

const mockSendMutateAsync = jest.fn(async () => ASSISTANT_MESSAGE);
const mockMarkRead = jest.fn();

jest.mock("@/features/chat/chat-api", () => ({
  useChatEnabled: () => true,
  useFeatures: () => ({
    data: { chat: true, assistant: true },
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
  useMarkChatRead: () => ({ mutate: mockMarkRead }),
  useSendChatMessage: () => ({
    mutateAsync: mockSendMutateAsync,
    isPending: false,
  }),
}));

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

describe("ChatScreen reply to an assistant message", () => {
  beforeEach(() => {
    mockSendMutateAsync.mockClear();
    mockMarkRead.mockClear();
  });

  it("shows a dismissible reply bar and sends with replyToId set", async () => {
    await i18n.changeLanguage("en");
    await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <ChatScreen />
      </SafeAreaProvider>,
    );

    await fireEvent.press(screen.getByTestId("chat-reply-assistant"));

    expect(screen.getByTestId("chat-reply-bar")).toBeTruthy();
    expect(screen.getByText("Replying to Folio")).toBeTruthy();

    await fireEvent.changeText(
      screen.getByTestId("chat-input"),
      "Merci, une autre question",
    );
    await fireEvent.press(screen.getByTestId("chat-send"));

    await waitFor(() => expect(mockSendMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockSendMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Merci, une autre question",
        replyToId: "assistant-1",
      }),
    );
    // The reply is consumed by the send; the bar clears itself.
    await waitFor(() =>
      expect(screen.queryByTestId("chat-reply-bar")).toBeNull(),
    );
  });

  it("dismisses the reply bar without sending anything", async () => {
    await i18n.changeLanguage("en");
    await render(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <ChatScreen />
      </SafeAreaProvider>,
    );

    await fireEvent.press(screen.getByTestId("chat-reply-assistant"));
    expect(screen.getByTestId("chat-reply-bar")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("chat-cancel-reply"));

    expect(screen.queryByTestId("chat-reply-bar")).toBeNull();
  });
});
