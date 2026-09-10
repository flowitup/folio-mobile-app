import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { useTokens } from "@/theme/tokens";

/** The site photograph behind the ink board (design 2c / 2d). */
const HERO = require("../../../assets/login-hero.jpg");

/**
 * Scrim over the photograph: clear at the top, ink by the bottom, so the
 * headline sitting on the photo stays readable. `backgroundImage` carries a
 * real gradient on RN 0.86; the stop list mirrors the design's CSS.
 */
const SCRIM =
  "linear-gradient(180deg, rgba(26,26,26,0) 0%, rgba(26,26,26,0) 42%, rgba(26,26,26,0.72) 72%, rgba(26,26,26,0.95) 100%)";

/** Paper field shell shared by both sign-in forms (design 2c: 52px, r10, line-2). */
export const FIELD =
  "h-[52px] flex-row items-center rounded-[10px] border border-line-2 bg-card px-3.5";

/**
 * Ink board above, paper sheet below. `pill` is the top-left affordance, which
 * sits on a dark chip so it stays legible over the board.
 */
export function LoginFrame({
  pill,
  headline,
  sub,
  children,
}: {
  pill: ReactNode;
  headline: string;
  sub: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <>
      <ImageBackground
        source={HERO}
        resizeMode="cover"
        className="flex-1 justify-end bg-ink-block-tile px-7 pb-7"
      >
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { experimental_backgroundImage: SCRIM },
          ]}
        />
        <View className="absolute left-7" style={{ top: insets.top + 8 }}>
          {pill}
        </View>
        <Text
          className="font-serif text-[38px] leading-[40px] text-on-ink-block"
          style={{ letterSpacing: -0.76 }}
        >
          {headline}
        </Text>
        <Text className="mt-2.5 max-w-[300px] font-sans text-[14.5px] leading-[22px] text-on-ink-block-2">
          {sub}
        </Text>
      </ImageBackground>
      <View
        className="rounded-t-[24px] bg-paper px-7 pt-[26px]"
        style={{ paddingBottom: insets.bottom + 28 }}
      >
        {children}
      </View>
    </>
  );
}

export function InkPill({
  onPress,
  testID,
  accessibilityLabel,
  children,
}: {
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  children: ReactNode;
}) {
  const content = (
    <View className="flex-row items-center gap-2 rounded-full bg-ink-block py-[5px] pl-1.5 pr-4">
      {children}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={12}
      className="active:opacity-70"
    >
      {content}
    </Pressable>
  );
}

/** Step 1: phone → "Send code"; step 2: the 6-digit code with a 60 s resend timer. */

export function SignInErrorLine({ error }: { error: string | null }) {
  const { t } = useTranslation();
  const tokens = useTokens();
  if (!error) return null;
  return (
    <View className="mb-4 flex-row items-start gap-1.5">
      <Icon
        name="alert-circle"
        size={15}
        color={tokens.negative}
        style={{ marginTop: 2 }}
      />
      <Text
        testID="login-error"
        className="flex-1 font-sans text-[13.5px] text-negative"
      >
        {t("login.failed", { message: error })}
      </Text>
    </View>
  );
}
