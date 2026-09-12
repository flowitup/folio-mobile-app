import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import type { ChatMessage } from "@/features/chat/chat-api";
import { formatClock, playbackFraction } from "@/lib/chat/voice-note";
import { cacheAuthedFile } from "@/lib/files/download";
import { useTokens } from "@/theme/tokens";

type PillProps = {
  mine: boolean;
  playing: boolean;
  busy: boolean;
  clock: string;
  fraction: number;
  onPress: () => void;
  testID?: string;
};

/**
 * The voice-note pill: play-pause button, progress bar and clock. Shared by a message bubble
 * and by the composer's review row so a downloaded note looks the same as a fresh recording.
 */
function VoicePill({
  mine,
  playing,
  busy,
  clock,
  fraction,
  onPress,
  testID,
}: PillProps) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const tint = mine ? "#ffffff" : tokens.ink;
  return (
    <View
      className={`w-[210px] flex-row items-center gap-2.5 px-3 py-[9px] ${mine ? "bg-positive" : "border border-line bg-card"}`}
      style={{
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomLeftRadius: mine ? 16 : 4,
        borderBottomRightRadius: mine ? 4 : 16,
      }}
    >
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={t(playing ? "chat.pauseVoice" : "chat.playVoice")}
        onPress={onPress}
        hitSlop={6}
        className="h-8 w-8 items-center justify-center rounded-full active:opacity-70"
        style={{
          backgroundColor: mine ? "rgba(255,255,255,0.22)" : tokens.paper2,
        }}
      >
        {busy ? (
          <ActivityIndicator size="small" color={tint} />
        ) : (
          <Icon name={playing ? "pause" : "play"} size={15} color={tint} />
        )}
      </Pressable>
      <View className="flex-1 gap-1.5">
        <View
          className="h-[3px] overflow-hidden rounded-full"
          style={{
            backgroundColor: mine ? "rgba(255,255,255,0.3)" : tokens.line,
          }}
        >
          <View
            testID="voice-progress"
            className="h-full rounded-full"
            style={{ width: `${fraction * 100}%`, backgroundColor: tint }}
          />
        </View>
        <Text
          className={`font-mono-regular text-[10.5px] ${mine ? "text-white" : "text-muted"}`}
        >
          {clock}
        </Text>
      </View>
    </View>
  );
}

/**
 * Plays a voice note already on disk. `durationMsHint` covers the moment before the player has
 * read the file — a just-finished recording knows its length before it is loaded.
 */
export function VoiceNotePlayer({
  uri,
  mine = false,
  durationMsHint = 0,
  autoPlay = false,
  testID,
}: {
  uri: string;
  mine?: boolean;
  durationMsHint?: number;
  autoPlay?: boolean;
  testID?: string;
}) {
  const player = useAudioPlayer(uri, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  // A bubble tapped before its bytes were on disk plays as soon as the file loads — once.
  const autoPlayed = useRef(false);

  useEffect(() => {
    if (!autoPlay || autoPlayed.current || !status.isLoaded) return;
    autoPlayed.current = true;
    player.play();
  }, [autoPlay, status.isLoaded, player]);

  const durationMs =
    status.duration > 0 ? status.duration * 1000 : durationMsHint;
  const positionMs = status.currentTime * 1000;

  function toggle() {
    if (status.playing) {
      player.pause();
      return;
    }
    // A note played to the end sits at its last frame; rewind so the button replays it.
    if (
      status.didJustFinish ||
      (durationMs > 0 && positionMs >= durationMs - 120)
    )
      player.seekTo(0);
    player.play();
  }

  return (
    <VoicePill
      mine={mine}
      playing={status.playing}
      busy={!status.isLoaded}
      clock={`${formatClock(status.playing || positionMs > 0 ? positionMs : durationMs)}${
        durationMs > 0 && positionMs > 0 ? ` / ${formatClock(durationMs)}` : ""
      }`}
      fraction={playbackFraction(positionMs, durationMs)}
      onPress={toggle}
      testID={testID}
    />
  );
}

/**
 * A voice note in the thread. The bytes need the Bearer token, so they are fetched into the
 * cache on the first tap rather than for every note in the channel, then played from disk.
 */
export function ChatVoiceBubble({
  message,
  mine,
}: {
  message: ChatMessage;
  mine: boolean;
}) {
  const { t } = useTranslation();
  const attachmentUrl = message.attachment?.url;
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!attachmentUrl) return null;

  function load() {
    if (loading || !attachmentUrl) return;
    setLoading(true);
    setFailed(false);
    void cacheAuthedFile(attachmentUrl, `chat-voice-${message.id}.m4a`)
      .then((local) => setUri(local))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }

  if (uri)
    return (
      <VoiceNotePlayer
        uri={uri}
        mine={mine}
        autoPlay
        testID={`chat-voice-${message.id}`}
      />
    );

  return (
    <View className="gap-1">
      <VoicePill
        mine={mine}
        playing={false}
        busy={loading}
        clock={t("chat.voiceNote")}
        fraction={0}
        onPress={load}
        testID={`chat-voice-${message.id}`}
      />
      {failed ? (
        <Text className="px-1 font-sans text-[10.5px] text-negative">
          {t("chat.voiceLoadFailed")}
        </Text>
      ) : null}
    </View>
  );
}
