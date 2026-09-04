import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { useTokens } from "@/theme/tokens";

type Props = {
  title: string;
  back?: boolean;
  /** Overrides the default history pop (e.g. leave a nested stack entirely). */
  onBack?: () => void;
  right?: ReactNode;
};

/**
 * Top bar of the "global" screens in the 2a shell: 40px back button, 17/600 title, paper
 * background, 1px line underneath. Safe-area aware. Falls back to the project tabs when there
 * is no history (deep link).
 */
export function ScreenHeader({ title, back = false, onBack, right }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();

  return (
    <View
      className="flex-row items-center gap-2 border-b border-line bg-paper py-2 pl-3 pr-3"
      style={{ paddingTop: insets.top + 8 }}
    >
      {back ? (
        <Pressable
          testID="header-back"
          accessibilityRole="button"
          onPress={
            onBack ??
            (() =>
              router.canGoBack() ? router.back() : router.navigate("/(app)/(tabs)"))
          }
          hitSlop={8}
          className="-ml-1.5 h-10 w-10 items-center justify-center active:opacity-70"
        >
          <Icon name="chevron-left" size={22} color={tokens.ink} />
        </Pressable>
      ) : null}
      <Text
        className="flex-1 font-sans-semibold text-[17px] text-ink"
        numberOfLines={1}
      >
        {title}
      </Text>
      {right}
    </View>
  );
}
