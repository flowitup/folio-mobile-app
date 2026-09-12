import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { showToast } from "@/components/ui/toast";
import { VoiceNotePlayer } from "@/features/chat/chat-voice-note";
import { useVoiceRecorder } from "@/features/chat/use-voice-recorder";
import {
  MAX_RECORDING_MS,
  formatClock,
  voiceNoteFilename,
} from "@/lib/chat/voice-note";
import { captureImage, pickImages } from "@/lib/files/pick";
import type { PickedFile } from "@/lib/files/pick";
import { useTokens } from "@/theme/tokens";

type Props = {
  /** No channel resolved yet: the composer renders but refuses to send. */
  disabled: boolean;
  sending: boolean;
  /** Rejects on an API error (already toasted); the draft survives so it can be sent again. */
  onSend: (message: { body: string; file: PickedFile | null }) => Promise<void>;
};

/**
 * Chat composer: attachment preview, text field, photo library / camera, microphone and send.
 *
 * A message carries at most one attachment, so a recording and a photo are the same slot —
 * picking one replaces the other. A recording is reviewed before it goes out: the mic button
 * starts it, the stop button ends it, and the take then sits above the field with a player and
 * a delete button until the reader presses send.
 */
export function ChatComposer({ disabled, sending, onSend }: Props) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<PickedFile | null>(null);
  // The cap ends a long recording on its own; say why rather than letting it stop silently.
  const voice = useVoiceRecorder(() =>
    showToast(
      t("chat.recordingMaxReached", {
        minutes: Math.round(MAX_RECORDING_MS / 60_000),
      }),
      "info",
    ),
  );

  const canSend =
    !disabled &&
    !sending &&
    !voice.recording &&
    (draft.trim().length > 0 || file !== null || voice.take !== null);

  async function submit() {
    if (!canSend) return;
    const attachment: PickedFile | null = voice.take
      ? {
          uri: voice.take.uri,
          name: voiceNoteFilename(),
          mimeType: "audio/m4a",
        }
      : file;
    try {
      await onSend({ body: draft, file: attachment });
      setDraft("");
      setFile(null);
      voice.discard();
    } catch {
      // useApiMutation already toasted; keep the draft so it can be sent again.
    }
  }

  async function attach(source: "camera" | "library") {
    const result =
      source === "camera" ? await captureImage() : await pickImages(false);
    if (result.status === "picked" && result.files[0]) {
      voice.discard();
      setFile(result.files[0]);
    } else if (result.status === "denied")
      showToast(t("chat.permissionDenied"), "error");
  }

  async function toggleRecording() {
    if (voice.recording) {
      await voice.stop();
      return;
    }
    setFile(null);
    const outcome = await voice.start();
    if (outcome === "denied") showToast(t("chat.microphoneDenied"), "error");
    else if (outcome === "failed")
      showToast(t("chat.recordingFailed"), "error");
  }

  return (
    <>
      {file ? (
        <View className="flex-row items-center gap-2 border-t border-line bg-paper px-4 py-2">
          <Icon name="image" size={16} color={tokens.muted} />
          <Text
            className="flex-1 font-mono-regular text-[11px] text-muted"
            numberOfLines={1}
          >
            {file.name}
          </Text>
          <Pressable
            testID="chat-remove-file"
            onPress={() => setFile(null)}
            hitSlop={8}
          >
            <Icon name="x" size={16} color={tokens.muted} />
          </Pressable>
        </View>
      ) : null}

      {voice.take ? (
        <View
          testID="chat-voice-review"
          className="flex-row items-center gap-2 border-t border-line bg-paper px-4 py-2"
        >
          <VoiceNotePlayer
            uri={voice.take.uri}
            durationMsHint={voice.take.durationMs}
            testID="chat-voice-preview"
          />
          <Pressable
            testID="chat-discard-voice"
            accessibilityRole="button"
            accessibilityLabel={t("chat.discardVoice")}
            onPress={voice.discard}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center active:opacity-70"
          >
            <Icon name="trash-2" size={17} color={tokens.negative} />
          </Pressable>
        </View>
      ) : null}

      <View
        className="flex-row items-center gap-2 border-t border-line bg-paper px-3 pt-2.5"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        {voice.recording ? (
          <View className="h-[42px] flex-1 flex-row items-center gap-2.5 rounded-full border border-line-2 bg-card px-3.5">
            <View className="h-2 w-2 rounded-full bg-negative" />
            <Text className="font-sans text-[13px] text-ink">
              {t("chat.recording")}
            </Text>
            <Text
              testID="chat-recording-clock"
              className="font-mono-regular text-[13px] text-muted"
            >
              {formatClock(voice.elapsedMs)}
            </Text>
          </View>
        ) : (
          <>
            <Pressable
              testID="chat-attach"
              accessibilityRole="button"
              accessibilityLabel={t("chat.attachImage")}
              onPress={() => void attach("library")}
              className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
            >
              <Icon name="plus" size={22} color={tokens.ink} />
            </Pressable>
            <TextInput
              testID="chat-input"
              className="h-[42px] flex-1 rounded-full border border-line-2 bg-card px-3.5 font-sans text-[14px] text-ink"
              placeholder={t("chat.placeholder")}
              placeholderTextColor={tokens.muted}
              value={draft}
              onChangeText={setDraft}
              multiline={false}
              returnKeyType="send"
              onSubmitEditing={() => void submit()}
            />
            <Pressable
              testID="chat-camera"
              accessibilityRole="button"
              accessibilityLabel={t("chat.takePhoto")}
              onPress={() => void attach("camera")}
              className="h-10 w-10 items-center justify-center active:opacity-70"
            >
              <Icon name="camera" size={22} color={tokens.ink} />
            </Pressable>
          </>
        )}

        <Pressable
          testID="chat-record"
          accessibilityRole="button"
          accessibilityLabel={t(
            voice.recording ? "chat.stopRecording" : "chat.recordVoice",
          )}
          accessibilityState={{ selected: voice.recording }}
          onPress={() => void toggleRecording()}
          className={`h-10 w-10 items-center justify-center rounded-full active:opacity-70 ${voice.recording ? "bg-negative" : ""}`}
        >
          <Icon
            name={voice.recording ? "square" : "mic"}
            size={voice.recording ? 16 : 21}
            color={voice.recording ? "#ffffff" : tokens.ink}
          />
        </Pressable>

        <Pressable
          testID="chat-send"
          accessibilityRole="button"
          accessibilityLabel={t("chat.send")}
          disabled={!canSend}
          onPress={() => void submit()}
          className={`h-10 w-10 items-center justify-center rounded-full bg-positive ${canSend ? "active:opacity-70" : "opacity-50"}`}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Icon name="send" size={18} color="#ffffff" />
          )}
        </Pressable>
      </View>
    </>
  );
}
