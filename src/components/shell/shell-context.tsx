import { usePathname } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PropsWithChildren } from "react";
import { BackHandler } from "react-native";

/** The shell sheets: one open at a time; scrim tap, tab change or navigation closes it. */
export type ShellSheet =
  "switcher" | "account" | "menu" | "notifications" | "help";

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
// The navigation that follows such a request (the push opens its route next) must not close
// the sheet it just asked for.
let keepSheetOnNextRoute = false;
export function requestShellSheet(sheet: ShellSheet): void {
  keepSheetOnNextRoute = true;
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

  // The sheets are drawn over every tab scene, so a screen opened by a deep link (a tapped
  // push, a link from a sheet-less screen) would appear under a sheet left open. Close it on
  // every route change, except the one right after an outside request for a sheet.
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (keepSheetOnNextRoute) {
      keepSheetOnNextRoute = false;
      return;
    }
    // Mirrors the router's state into the shell's; there is no event to subscribe to instead.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSheet(null);
  }, [pathname]);

  // The shell sheets are plain views, not native modals, so Android's hardware Back never
  // reached them: it left the screen underneath instead of closing the open panel.
  useEffect(() => {
    if (sheet === null) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        setSheet(null);
        return true;
      },
    );
    return () => subscription.remove();
  }, [sheet]);

  const openSheet = useCallback((next: ShellSheet) => {
    keepSheetOnNextRoute = false;
    setSheet(next);
  }, []);
  const closeSheet = useCallback(() => {
    keepSheetOnNextRoute = false;
    setSheet(null);
  }, []);
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
