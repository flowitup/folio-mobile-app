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

/**
 * How a recording ended. `failed` means a take was expected and is gone — the device ended the
 * recording under us (a call came in, another app took the input) or the file never appeared;
 * the reader has to be told, or minutes of talking vanish silently. `empty` is a stop with
 * nothing to lose.
 */
export type StopOutcome = "take" | "empty" | "failed";

export type VoiceRecorder = {
  /** True from the moment `start()` succeeds until `stop()` is called. */
  recording: boolean;
  /** Elapsed milliseconds while recording; `0` otherwise. */
  elapsedMs: number;
  /** The finished recording waiting to be sent or discarded. */
  take: VoiceRecording | null;
  /** Asks for the microphone and starts recording. */
  start: () => Promise<StartOutcome>;
  /** Stops and keeps the take. */
  stop: () => Promise<StopOutcome>;

  /**
   * Throws the take away. Pass the take that was just sent to drop only that one: by the time
   * an upload resolves the reader may have recorded another, and clearing blindly would delete
   * a recording that was never sent.
   */
  discard: (only?: VoiceRecording) => void;
};

/**
 * Microphone recording for the chat composer: one take at a time, capped at
 * `MAX_RECORDING_MS` so a forgotten recording cannot exceed the attachment limit.
 * `onCapReached` fires when the cap — not the reader — ended the recording, so the screen can
 * say why it stopped on its own.
 *
 * `recording` is this hook's own state rather than the recorder's, because
 * `useAudioRecorderState` polls the native recorder every 250 ms: a screen driven by that poll
 * still shows the idle composer for a quarter second after the mic is tapped, which is long
 * enough to start a second recording or attach a photo over the first.
 *
 * `allowsRecording` is a process-wide iOS audio-session flag, not per-recorder state, so it is
 * handed back on every path out of a recording — a normal stop, a failed start, a stop that
 * found nothing, and unmounting mid-recording. Leaving it set routes later playback to the
 * earpiece for the rest of the session.
 */
export function useVoiceRecorder(onCapReached?: () => void): VoiceRecorder {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [take, setTake] = useState<VoiceRecording | null>(null);
  const [recording, setRecording] = useState(false);
  // Mirrors `recording` for the handlers, which have to read it before the next render.
  const isRecording = useRef(false);
  // One start or stop in flight at a time; a second tap inside the first is ignored.
  const busy = useRef(false);
  // Ends a recording the reader forgot about, so a take can never exceed the attachment limit.
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest polled duration, so a cap-ended take is not stamped with the length at arming time.
  const elapsed = useRef(0);
  // Read through refs: both are armed once, and change on later renders.
  const capCallback = useRef(onCapReached);
  const recorderRef = useRef(recorder);

  useEffect(() => {
    capCallback.current = onCapReached;
  }, [onCapReached]);
  useEffect(() => {
    elapsed.current = state.durationMillis;
  }, [state.durationMillis]);
  useEffect(() => {
    recorderRef.current = recorder;
  }, [recorder]);

  const clearCap = useCallback(() => {
    if (capTimer.current) clearTimeout(capTimer.current);
    capTimer.current = null;
  }, []);

  const releaseSession = useCallback(
    () =>
      setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      }).catch(() => undefined),
    [],
  );

  const stop = useCallback(async (): Promise<StopOutcome> => {
    if (busy.current || !isRecording.current) return "empty";
    busy.current = true;
    clearCap();
    isRecording.current = false;
    setRecording(false);
    const durationMs = elapsed.current;
    try {
      // The recorder stopping on its own is the device taking the input away from us.
      if (!recorder.isRecording) return "failed";
      await recorder.stop();
      if (!recorder.uri) return "failed";
      setTake({ uri: recorder.uri, durationMs });
      return "take";
    } catch (error) {
      if (__DEV__) console.error("[useVoiceRecorder] stop", error);
      return "failed";
    } finally {
      await releaseSession();
      busy.current = false;
    }
  }, [recorder, clearCap, releaseSession]);

  const start = useCallback(async (): Promise<StartOutcome> => {
    if (busy.current || isRecording.current) return "started";
    busy.current = true;
    try {
      const permission =
        await AudioModule.requestRecordingPermissionsAsync().catch(() => ({
          granted: false,
        }));
      if (!permission.granted) return "denied";
      setTake(null);
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      // `record()` does not throw when the platform refuses the input; it just never starts.
      if (!recorder.isRecording) throw new Error("Recorder did not start");
      isRecording.current = true;
      setRecording(true);
      elapsed.current = 0;
      clearCap();
      capTimer.current = setTimeout(() => {
        // Only a recording the cap actually ended is worth explaining.
        void stop().then((outcome) => {
          if (outcome === "take") capCallback.current?.();
        });
      }, MAX_RECORDING_MS);
      return "started";
    } catch (error) {
      // An input the platform will not open (none present, or held by another app).
      if (__DEV__) console.error("[useVoiceRecorder] start", error);
      await releaseSession();
      return "failed";
    } finally {
      busy.current = false;
    }
  }, [recorder, clearCap, releaseSession, stop]);

  // Leaving the screen mid-recording must still release the microphone and the audio session.
  useEffect(
    () => () => {
      if (capTimer.current) clearTimeout(capTimer.current);
      if (!isRecording.current) return;
      isRecording.current = false;
      void recorderRef.current.stop().catch(() => undefined);
      void setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      }).catch(() => undefined);
    },
    [],
  );

  return {
    recording,
    elapsedMs: recording ? state.durationMillis : 0,
    take,
    start,
    stop,
    discard: useCallback(
      (only?: VoiceRecording) =>
        setTake((current) => (only && current !== only ? current : null)),
      [],
    ),
  };
}
