import { colorScheme } from "nativewind";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PropsWithChildren } from "react";
import * as SecureStore from "expo-secure-store";

/** What the user picked in Settings — not necessarily what is on screen. */
export type ThemePreference = "system" | "light" | "dark";

export const THEME_PREFERENCES: readonly ThemePreference[] = [
  "system",
  "light",
  "dark",
] as const;

const STORAGE_KEY = "theme_preference";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * Pushes the choice into NativeWind, which is the single source of truth for
 * both halves of the palette: the `prefers-color-scheme` block in global.css
 * that styles every className, and `useTokens()`, which reads NativeWind's
 * scheme so the JS colors cannot drift from the CSS ones.
 */
function apply(preference: ThemePreference): void {
  colorScheme.set(preference);
}

type ThemePreferenceValue = {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
};

const ThemePreferenceContext = createContext<ThemePreferenceValue | null>(null);

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  // Restore on launch. Until this resolves the app follows the device, which is
  // the same thing it did before this setting existed — so no flash of the
  // wrong palette for the majority who never change it.
  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY).catch(
        () => null,
      );
      if (!isThemePreference(stored)) return;
      setPreferenceState(stored);
      apply(stored);
    })();
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    apply(next);
    // Best effort: a failed write costs the choice on next launch, never the
    // choice now, so it must not block the repaint.
    void SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ preference, setPreference }),
    [preference, setPreference],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceValue {
  const context = useContext(ThemePreferenceContext);
  if (!context) {
    throw new Error(
      "useThemePreference must be used inside ThemePreferenceProvider",
    );
  }
  return context;
}
