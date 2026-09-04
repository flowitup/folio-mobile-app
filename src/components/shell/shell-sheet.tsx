import { useEffect, useState } from "react";
import type { PropsWithChildren } from "react";
import { Animated, Easing, Pressable, View } from "react-native";

import { useShell } from "@/components/shell/shell-context";

const SLIDE_MS = 220;

/**
 * The shell's in-place bottom panel (switcher / account / menu / reminders): scrim over the
 * content but not over the tab bar, paper panel r20 with 8px side margins sitting on top of the
 * tab bar, 36×4 grabber, 220ms ease-out slide. Tap the scrim to close.
 */
export function ShellSheet({
  open,
  children,
  testID,
}: PropsWithChildren<{ open: boolean; testID?: string }>) {
  const { tabBarHeight, closeSheet } = useShell();
  const [mounted, setMounted] = useState(open);
  // Lazily created once; kept in state (not a ref) so reading it during render is lint-clean.
  const [progress] = useState(() => new Animated.Value(open ? 1 : 0));

  useEffect(() => {
    if (open) {
      // Mounting and animating on the same tick keeps the slide-in visible.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
    }
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
    return () => animation.stop();
  }, [open, progress]);

  if (!mounted) return null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 top-0"
      style={{ bottom: tabBarHeight }}
      testID={testID}
    >
      <Animated.View
        className="absolute inset-0 bg-scrim"
        style={{ opacity: progress }}
      >
        <Pressable
          testID="shell-sheet-scrim"
          className="flex-1"
          onPress={closeSheet}
          accessibilityRole="button"
        />
      </Animated.View>
      <Animated.View
        className="absolute inset-x-2 bottom-0 rounded-2.5xl bg-paper px-3.5 pb-4 pt-2"
        style={{
          boxShadow: "0 -12px 40px rgba(0,0,0,0.18)",
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [420, 0],
              }),
            },
          ],
        }}
      >
        <View className="mb-3.5 h-1 w-9 self-center rounded-sm bg-line-2" />
        {children}
      </Animated.View>
    </View>
  );
}
