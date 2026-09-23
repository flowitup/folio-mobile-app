/**
 * The `@folio` mention suggestion in the composer: it appears once the token the reader is
 * typing starts with "@", and tapping it inserts "@folio " in place of that token.
 */
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import { ChatComposer } from "@/features/chat/chat-composer";
import i18n from "@/i18n";

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

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

async function renderComposer(assistantEnabled?: boolean) {
  await i18n.changeLanguage("en");
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <ChatComposer
        disabled={false}
        sending={false}
        onSend={jest.fn()}
        {...(assistantEnabled === undefined ? {} : { assistantEnabled })}
      />
    </SafeAreaProvider>,
  );
}

describe("ChatComposer @folio mention suggestion", () => {
  it("stays hidden until the last token starts with @", async () => {
    await renderComposer();
    expect(screen.queryByTestId("chat-mention-suggestion")).toBeNull();

    await fireEvent.changeText(screen.getByTestId("chat-input"), "hello ");
    expect(screen.queryByTestId("chat-mention-suggestion")).toBeNull();
  });

  it("shows once the reader starts an @-token, and inserts @folio on tap", async () => {
    await renderComposer();

    await fireEvent.changeText(screen.getByTestId("chat-input"), "hey @fo");
    expect(screen.getByTestId("chat-mention-suggestion")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("chat-mention-suggestion"));

    expect(screen.getByTestId("chat-input").props.value).toBe("hey @folio ");
    // Once inserted, the trailing space ends the token and the suggestion goes away.
    expect(screen.queryByTestId("chat-mention-suggestion")).toBeNull();
  });

  it("replaces only the token being typed, keeping the rest of the draft", async () => {
    await renderComposer();

    await fireEvent.changeText(
      screen.getByTestId("chat-input"),
      "matériaux au 12 @f",
    );
    await fireEvent.press(screen.getByTestId("chat-mention-suggestion"));

    expect(screen.getByTestId("chat-input").props.value).toBe(
      "matériaux au 12 @folio ",
    );
  });

  it("never shows once the assistant feature is off, even mid @-token", async () => {
    await renderComposer(false);

    await fireEvent.changeText(screen.getByTestId("chat-input"), "hey @fo");
    expect(screen.queryByTestId("chat-mention-suggestion")).toBeNull();
  });
});
