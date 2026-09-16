import { useBottomSheetModal } from "@gorhom/bottom-sheet";
import { usePathname } from "expo-router";
import { useEffect, useRef } from "react";

/**
 * A sheet belongs to the modal provider, not to the screen that opened it, so it outlives
 * that screen: a deep link arriving while a form sheet is up — a push notification, say —
 * left the sheet floating over whatever screen the link opened. Close them on every route
 * change. A tab switch cannot happen with a sheet up (the sheet covers the tab bar), so
 * this only fires for navigation the user did not start from the sheet itself.
 *
 * Render it inside `BottomSheetModalProvider`.
 */
export function DismissSheetsOnRouteChange() {
  const pathname = usePathname();
  const { dismissAll } = useBottomSheetModal();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    dismissAll();
  }, [pathname, dismissAll]);

  return null;
}
