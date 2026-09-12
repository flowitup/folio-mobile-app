import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

import { MAX_RECORDING_MS } from "@/lib/chat/voice-note";

/** What the composer is currently holding: nothing, a running recording, or one to review. */
export type VoiceRecording = { uri: string; durationMs: number };

/**
 * Why a recording is not running after `start()`: the reader refused the microphone, or the
 * device would not open an input (no microphone, or one held by another app). Both need to be
 * said out loud — a mic button that does nothing reads as a broken app.
 */
export type StartOutcome = "started" | "denied" | "failed";

export type VoiceRecorder = {
  /** True between `start()` and `stop()`. */
  recording: boolean;
  /** Elapsed milliseconds while recording; `0` otherwise. */
  elapsedMs: number;
  /** The finished recording waiting to be sent or discarded. */
  take: VoiceRecording | null;
  /** Asks for the microphone and starts recording. */
  start: () => Promise<StartOutcome>;
  /** Stops and keeps the take. */
  stop: () => Promise<void>;
  /** Throws the take away (after sending it, or when the reader deletes it). */
  discard: () => void;
};

/**
 * Microphone recording for the chat composer: one take at a time, capped at
 * `MAX_RECORDING_MS` so a forgotten recording cannot exceed the attachment limit.
 * `onCapReached` fires when the cap — not the reader — ended the recording, so the screen can
 * say why it stopped on its own.
 *
 * iOS routes playback to the earpiece while the recording session is open, so the audio mode
 * is switched back as soon as the take is finished — otherwise reviewing it is barely audible.
 */
export function useVoiceRecorder(onCapReached?: () => void): VoiceRecorder {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [take, setTake] = useState<VoiceRecording | null>(null);
  // `stop` is called both by the reader and by the length cap; the ref keeps one in flight.
  const stopping = useRef(false);
  // Ends a recording the reader forgot about, so a take can never exceed the attachment limit.
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read through a ref: the timer is armed once, the callback changes on every render.
  const capCallback = useRef(onCapReached);
  useEffect(() => {
    capCallback.current = onCapReached;
  }, [onCapReached]);

  const stop = useCallback(async (): Promise<void> => {
    if (stopping.current || !recorder.isRecording) return;
    stopping.current = true;
    if (capTimer.current) clearTimeout(capTimer.current);
    capTimer.current = null;
    try {
      await recorder.stop();
      if (recorder.uri)
        setTake({ uri: recorder.uri, durationMs: state.durationMillis });
    } catch (error) {
      if (__DEV__) console.error("[useVoiceRecorder] stop", error);
    } finally {
      // Always hand the session back, or iOS keeps playback on the earpiece.
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      }).catch(() => undefined);
      stopping.current = false;
    }
  }, [recorder, state.durationMillis]);

  const start = useCallback(async (): Promise<StartOutcome> => {
    const permission =
      await AudioModule.requestRecordingPermissionsAsync().catch(() => ({
        granted: false,
      }));
    if (!permission.granted) return "denied";
    setTake(null);
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      // `record()` does not throw when the platform refuses the input; it just never starts.
      if (!recorder.isRecording) throw new Error("Recorder did not start");
      capTimer.current = setTimeout(() => {
        void stop().then(() => capCallback.current?.());
      }, MAX_RECORDING_MS);
    } catch (error) {
      // An input the platform will not open (none present, or held by another app).
      if (__DEV__) console.error("[useVoiceRecorder] start", error);
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      }).catch(() => undefined);
      return "failed";
    }
    return "started";
  }, [recorder, stop]);

  // Nothing is recording once the screen is gone; do not leave the cap timer behind.
  useEffect(
    () => () => {
      if (capTimer.current) clearTimeout(capTimer.current);
    },
    [],
  );

  return {
    recording: state.isRecording,
    elapsedMs: state.isRecording ? state.durationMillis : 0,
    take,
    start,
    stop,
    discard: useCallback(() => setTake(null), []),
  };
}
