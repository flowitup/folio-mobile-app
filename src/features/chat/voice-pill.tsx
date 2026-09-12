import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { useTokens } from "@/theme/tokens";

type Props = {
  mine: boolean;
  playing: boolean;
  busy: boolean;
  clock: string;
  /** 0..1 of the note already played; drives the progress bar. */
  fraction: number;
  onPress: () => void;
  testID?: string;
};

/**
 * The voice-note pill: play-pause button, progress bar and clock. Shared by a message bubble
 * and by the composer's review row so a downloaded note looks the same as a fresh recording.
 */
export function VoicePill({
  mine,
  playing,
  busy,
  clock,
  fraction,
  onPress,
  testID,
}: Props) {
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
