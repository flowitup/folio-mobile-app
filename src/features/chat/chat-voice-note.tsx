import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import type { ChatMessage } from "@/features/chat/chat-api";
import { VoicePill } from "@/features/chat/voice-pill";
import { formatClock, playbackFraction } from "@/lib/chat/voice-note";
import { cacheAuthedFile } from "@/lib/files/download";

/** A note that can be silenced when another one starts. */
type Silenceable = { pause: () => void };

/**
 * The note currently playing. Voice notes are separate components with a player each, so
 * without this a second tap leaves two people talking over each other.
 */
let playingNote: Silenceable | null = null;

function claimPlayback(note: Silenceable): void {
  if (playingNote && playingNote !== note) playingNote.pause();
  playingNote = note;
}

function releasePlayback(note: Silenceable): void {
  if (playingNote === note) playingNote = null;
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
  // Stable identity for the registry; its `pause` follows the current player.
  const self = useRef<Silenceable>({ pause: () => {} });

  useEffect(() => {
    self.current.pause = () => player.pause();
  }, [player]);

  useEffect(() => {
    if (!autoPlay || autoPlayed.current || !status.isLoaded) return;
    autoPlayed.current = true;
    claimPlayback(self.current);
    player.play();
  }, [autoPlay, status.isLoaded, player]);

  // Whatever happens to this note, it must not stay the one everything else is muted for.
  useEffect(() => {
    const note = self.current;
    return () => releasePlayback(note);
  }, []);

  const durationMs =
    status.duration > 0 ? status.duration * 1000 : durationMsHint;
  const positionMs = status.currentTime * 1000;

  async function toggle() {
    if (status.playing) {
      player.pause();
      return;
    }
    claimPlayback(self.current);
    // A note played to the end sits at its last frame; rewind so the button replays it. The
    // seek is awaited, or playback can start at the old position and report itself finished.
    if (
      status.didJustFinish ||
      (durationMs > 0 && positionMs >= durationMs - 120)
    )
      await player.seekTo(0);
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
      onPress={() => void toggle()}
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
  const attachment = message.attachment;
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!attachment) return null;

  function load() {
    if (loading || !attachment) return;
    setLoading(true);
    setFailed(false);
    void cacheAuthedFile(
      attachment.url,
      `chat-voice-${message.id}.m4a`,
      attachment.size_bytes,
    )
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
