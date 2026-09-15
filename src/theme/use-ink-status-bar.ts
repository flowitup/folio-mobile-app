import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { setStatusBarStyle } from "expo-status-bar";

/**
 * Keeps the status bar readable over a header whose darkness is fixed.
 *
 * Not `<StatusBar style=… />`: that sets the bar when it mounts and does NOT put
 * it back when it unmounts, so walking from an ink screen to a paper one left
 * white glyphs on cream — measured at 1.12:1 on the chat screen. Tying it to
 * focus means the screen owns the bar only while it is the screen you are on.
 */
export function useInkStatusBar(ink: boolean): void {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(ink ? "light" : "auto");
      return () => setStatusBarStyle("auto");
    }, [ink]),
  );
}
