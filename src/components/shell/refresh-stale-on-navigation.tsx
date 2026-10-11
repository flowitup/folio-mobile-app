import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "expo-router";
import { useEffect, useRef } from "react";

/**
 * Tab screens stay mounted, so a screen coming back into view never re-runs its queries, and
 * data that changed elsewhere (a project access granted by someone else, a teammate's invoice)
 * stayed on screen until the app was restarted. Refetch what is on screen and past its stale
 * time on every route change; fresh data is left alone, so quick back-and-forth costs nothing.
 *
 * Render it inside the `QueryClientProvider`.
 */
export function RefreshStaleOnNavigation() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    void queryClient.refetchQueries({
      type: "active",
      stale: true,
      // A query already on its way would only be cancelled and restarted.
      predicate: (query) => query.state.fetchStatus !== "fetching",
    });
  }, [pathname, queryClient]);

  return null;
}
