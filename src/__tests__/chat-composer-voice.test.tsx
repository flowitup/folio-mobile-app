/**
 * The voice-message path through the composer: the mic opens a recording, the stop button turns
 * it into a take the reader can review, and send uploads that take as the message's attachment.
 *
 * `expo-audio` is a native module, so it is mocked with a recorder whose state real React
 * subscribers observe — the timer and the stop button only appear if the hook re-renders.
 *
 * `fireEvent` is awaited throughout: on React Native Testing Library 14 it resolves
 * asynchronously, and without the await the state update never lands.
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Metrics } from "react-native-safe-area-context";

import type { ComponentProps } from "react";

import { ChatComposer } from "@/features/chat/chat-composer";
import i18n from "@/i18n";
import { MAX_RECORDING_MS } from "@/lib/chat/voice-note";

const RECORDED_URI = "file:///tmp/recording-abc.m4a";

jest.mock("expo-audio", () => {
  // A jest.mock factory runs before the module's imports, so React arrives by require here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  const state = {
    isRecording: false,
    durationMillis: 0,
    uri: null as string | null,
    recordCalls: 0,
  };
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  return {
    RecordingPresets: { HIGH_QUALITY: {} },
    AudioModule: {
      requestRecordingPermissionsAsync: jest.fn(async () => ({
        granted: mockPermissionGranted,
      })),
    },
    setAudioModeAsync: jest.fn(async () => undefined),
    useAudioRecorder: () => {
      const ref = React.useRef(null);
      if (!ref.current)
        ref.current = {
          get isRecording() {
            return state.isRecording;
          },
          get uri() {
            return state.uri;
          },
          prepareToRecordAsync: jest.fn(async () => undefined),
          record: () => {
            state.recordCalls += 1;
            if (!mockRecorderStarts) return;
            state.isRecording = true;
            state.durationMillis = 0;
            emit();
          },
          stop: jest.fn(async () => {
            if (!mockStopSucceeds) throw new Error("stop failed");
            state.isRecording = false;
            state.uri = RECORDED_URI;
            emit();
          }),
        };
      return ref.current;
    },
    useAudioRecorderState: () => {
      const [, bump] = React.useState(0);
      React.useEffect(() => {
        const listener = () => bump((n: number) => n + 1);
        listeners.add(listener);
        return () => void listeners.delete(listener);
      }, []);
      return {
        isRecording: state.isRecording,
        durationMillis: state.durationMillis,
      };
    },
    useAudioPlayer: () => ({
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(),
    }),
    useAudioPlayerStatus: () => ({
      isLoaded: true,
      playing: false,
      currentTime: 0,
      duration: 4.2,
      didJustFinish: false,
    }),
    __control: {
      reset: () => {
        state.isRecording = false;
        state.durationMillis = 0;
        state.uri = null;
        state.recordCalls = 0;
      },
      recordCalls: () => state.recordCalls,
      advanceTo: (ms: number) => {
        state.durationMillis = ms;
        emit();
      },
    },
  };
});

// Flipped by the test that refuses the microphone.
let mockPermissionGranted = true;
// Flipped by the test where the platform will not open an audio input.
let mockRecorderStarts = true;
// Flipped by the test where the device takes the input away mid-recording.
let mockStopSucceeds = true;

jest.mock("@/components/ui/toast", () => ({
  showToast: jest.fn(),
}));

// The photo picker is native; the tests decide what it returns.
let mockPickResult: unknown = { status: "canceled" };
jest.mock("@/lib/files/pick", () => ({
  pickImages: jest.fn(async () => mockPickResult),
  captureImage: jest.fn(async () => mockPickResult),
}));

const audio = jest.requireMock("expo-audio") as {
  __control: {
    reset: () => void;
    advanceTo: (ms: number) => void;
    recordCalls: () => number;
  };
};
const { showToast } = jest.requireMock("@/components/ui/toast") as {
  showToast: jest.Mock;
};

const SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

type OnSend = ComponentProps<typeof ChatComposer>["onSend"];

async function renderComposer(
  onSend: OnSend = jest.fn(async (): Promise<void> => {}),
) {
  await i18n.changeLanguage("en");
  await render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <ChatComposer disabled={false} sending={false} onSend={onSend} />
    </SafeAreaProvider>,
  );
  return onSend;
}

describe("ChatComposer voice messages", () => {
  beforeEach(() => {
    audio.__control.reset();
    mockPermissionGranted = true;
    mockRecorderStarts = true;
    mockStopSucceeds = true;
    mockPickResult = { status: "canceled" };
    showToast.mockClear();
  });

  it("swaps the text field for a running clock while recording", async () => {
    await renderComposer();
    expect(screen.getByTestId("chat-input")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("chat-record"));

    await waitFor(() =>
      expect(screen.getByTestId("chat-recording-clock")).toBeTruthy(),
    );
    expect(screen.queryByTestId("chat-input")).toBeNull();
    expect(screen.getByTestId("chat-recording-clock").props.children).toBe(
      "0:00",
    );

    await act(async () => audio.__control.advanceTo(7_000));
    await waitFor(() =>
      expect(screen.getByTestId("chat-recording-clock").props.children).toBe(
        "0:07",
      ),
    );
  });

  it("sends the finished take as an audio attachment and clears the composer", async () => {
    const onSend = await renderComposer();
    await fireEvent.press(screen.getByTestId("chat-record"));
    await waitFor(() => screen.getByTestId("chat-recording-clock"));

    await fireEvent.press(screen.getByTestId("chat-record"));
    await waitFor(() =>
      expect(screen.getByTestId("chat-voice-review")).toBeTruthy(),
    );
    expect(screen.getByTestId("chat-voice-preview")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("chat-send"));

    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend).toHaveBeenCalledWith({
      body: "",
      file: {
        uri: RECORDED_URI,
        name: expect.stringMatching(/^voice-\d+\.m4a$/),
        mimeType: "audio/m4a",
      },
    });
    await waitFor(() =>
      expect(screen.queryByTestId("chat-voice-review")).toBeNull(),
    );
  });

  it("keeps a take recorded while an earlier message is still uploading", async () => {
    let finishSend: () => void = () => {};
    const onSend = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSend = () => resolve();
        }),
    );
    await renderComposer(onSend);

    await fireEvent.press(screen.getByTestId("chat-record"));
    await fireEvent.press(screen.getByTestId("chat-record"));
    await waitFor(() => screen.getByTestId("chat-voice-review"));
    await fireEvent.press(screen.getByTestId("chat-send"));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));

    // A second take recorded while the first is still uploading.
    await fireEvent.press(screen.getByTestId("chat-record"));
    await fireEvent.press(screen.getByTestId("chat-record"));
    await waitFor(() => screen.getByTestId("chat-voice-review"));

    await act(async () => {
      finishSend();
    });

    // The upload finishing must not take the new recording with it.
    expect(screen.getByTestId("chat-voice-review")).toBeTruthy();
  });

  it("throws the take away when the reader deletes it", async () => {
    const onSend = await renderComposer();
    await fireEvent.press(screen.getByTestId("chat-record"));
    await waitFor(() => screen.getByTestId("chat-recording-clock"));
    await fireEvent.press(screen.getByTestId("chat-record"));
    await waitFor(() => screen.getByTestId("chat-voice-review"));

    await fireEvent.press(screen.getByTestId("chat-discard-voice"));

    await waitFor(() =>
      expect(screen.queryByTestId("chat-voice-review")).toBeNull(),
    );
    await fireEvent.press(screen.getByTestId("chat-send"));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("stops itself at the length cap, says so, and keeps the take", async () => {
    jest.useFakeTimers();
    try {
      await renderComposer();
      await fireEvent.press(screen.getByTestId("chat-record"));
      expect(screen.getByTestId("chat-recording-clock")).toBeTruthy();

      await act(async () => {
        audio.__control.advanceTo(MAX_RECORDING_MS);
        jest.advanceTimersByTime(MAX_RECORDING_MS);
      });

      expect(screen.getByTestId("chat-voice-review")).toBeTruthy();
      expect(screen.getByTestId("chat-input")).toBeTruthy();
      expect(showToast).toHaveBeenCalledWith(
        i18n.t("chat.recordingMaxReached", { minutes: 5 }),
        "info",
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("keeps a recording to one tap even before the recorder state has polled", async () => {
    await renderComposer();

    await fireEvent.press(screen.getByTestId("chat-record"));
    await fireEvent.press(screen.getByTestId("chat-record"));

    // The second tap must not start a second recording, and must not claim one failed.
    expect(audio.__control.recordCalls()).toBe(1);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("keeps an attached photo when the microphone is refused", async () => {
    mockPermissionGranted = false;
    mockPickResult = {
      status: "picked",
      files: [
        {
          uri: "file:///tmp/site.jpg",
          name: "site.jpg",
          mimeType: "image/jpeg",
        },
      ],
    };
    await renderComposer();
    await fireEvent.press(screen.getByTestId("chat-attach"));
    await waitFor(() =>
      expect(screen.getByTestId("chat-remove-file")).toBeTruthy(),
    );

    await fireEvent.press(screen.getByTestId("chat-record"));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        i18n.t("chat.microphoneDenied"),
        "error",
      ),
    );
    expect(screen.getByTestId("chat-remove-file")).toBeTruthy();
  });

  it("says so when the device loses the recording instead of dropping it in silence", async () => {
    mockStopSucceeds = false;
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});
    await renderComposer();
    await fireEvent.press(screen.getByTestId("chat-record"));
    await waitFor(() => screen.getByTestId("chat-recording-clock"));

    await fireEvent.press(screen.getByTestId("chat-record"));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        i18n.t("chat.recordingLost"),
        "error",
      ),
    );
    expect(screen.queryByTestId("chat-voice-review")).toBeNull();
    logged.mockRestore();
  });

  it("says so when the platform refuses to open an input", async () => {
    mockRecorderStarts = false;
    // The hook logs the underlying error in dev; keep it out of the test output.
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});
    await renderComposer();

    await fireEvent.press(screen.getByTestId("chat-record"));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        i18n.t("chat.recordingFailed"),
        "error",
      ),
    );
    expect(screen.queryByTestId("chat-recording-clock")).toBeNull();
    logged.mockRestore();
  });

  it("says so when the microphone is refused, and records nothing", async () => {
    mockPermissionGranted = false;
    await renderComposer();

    await fireEvent.press(screen.getByTestId("chat-record"));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        i18n.t("chat.microphoneDenied"),
        "error",
      ),
    );
    expect(screen.getByTestId("chat-input")).toBeTruthy();
    expect(screen.queryByTestId("chat-recording-clock")).toBeNull();
  });
});
