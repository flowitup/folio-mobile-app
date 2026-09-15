import { useColorScheme } from "nativewind";
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

/**
 * Folio is a light-first design, so the app opens light regardless of the phone's
 * setting. "Comme l'appareil" stays on the menu for anyone who wants the old
 * behaviour back — it is a choice now rather than the default.
 */
const DEFAULT_PREFERENCE: ThemePreference = "light";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

type ThemePreferenceValue = {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
};

const ThemePreferenceContext = createContext<ThemePreferenceValue | null>(null);

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(DEFAULT_PREFERENCE);
  // Bound to NativeWind's live store. The module-level `colorScheme.set` only
  // sticks when fired from a user event: issued while the tree is mounting,
  // NativeWind's own initialisation from the device lands after it and wins —
  // verified on a dark simulator, where the app opened dark with "Clair"
  // selected in state.
  const { setColorScheme } = useColorScheme();

  // Restore the stored choice. A missing or corrupted value leaves the default in
  // place, so a fresh install and a locked keychain agree.
  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY).catch(
        () => null,
      );
      if (!isThemePreference(stored)) return;
      setPreferenceState(stored);
    })();
  }, []);

  // One place asserts the palette, and it re-asserts whenever the choice changes,
  // so nothing NativeWind does during startup can leave the two out of step.
  useEffect(() => {
    setColorScheme(preference);
  }, [preference, setColorScheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
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
