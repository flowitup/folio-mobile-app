import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PropsWithChildren } from "react";

/** The shell sheets: one open at a time; scrim tap, tab change or navigation closes it. */
export type ShellSheet = "switcher" | "account" | "menu" | "notifications";

type ShellValue = {
  sheet: ShellSheet | null;
  openSheet: (sheet: ShellSheet) => void;
  toggleSheet: (sheet: ShellSheet) => void;
  closeSheet: () => void;
  /** Measured height of the floating tab bar; sheets sit right above it. */
  tabBarHeight: number;
  setTabBarHeight: (height: number) => void;
};

const ShellContext = createContext<ShellValue | null>(null);

// A sheet asked for from outside the shell (a tapped push): consumed by the next ShellProvider
// mount, or applied immediately when one is already mounted.
let pendingSheet: ShellSheet | null = null;
let mountedSetter: ((sheet: ShellSheet | null) => void) | null = null;
export function requestShellSheet(sheet: ShellSheet): void {
  if (mountedSetter) mountedSetter(sheet);
  else pendingSheet = sheet;
}

export function ShellProvider({ children }: PropsWithChildren) {
  const [sheet, setSheet] = useState<ShellSheet | null>(() => {
    const initial = pendingSheet;
    pendingSheet = null;
    return initial;
  });
  useEffect(() => {
    mountedSetter = setSheet;
    return () => {
      mountedSetter = null;
    };
  }, []);
  const [tabBarHeight, setTabBarHeight] = useState(0);

  const openSheet = useCallback((next: ShellSheet) => setSheet(next), []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const toggleSheet = useCallback(
    (next: ShellSheet) =>
      setSheet((current) => (current === next ? null : next)),
    [],
  );

  const value = useMemo(
    () => ({
      sheet,
      openSheet,
      toggleSheet,
      closeSheet,
      tabBarHeight,
      setTabBarHeight,
    }),
    [sheet, openSheet, toggleSheet, closeSheet, tabBarHeight],
  );

  return (
    <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
  );
}

export function useShell(): ShellValue {
  const context = useContext(ShellContext);
  if (!context) throw new Error("useShell must be used inside ShellProvider");
  return context;
}
