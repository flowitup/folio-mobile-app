import { QueryClient } from "@tanstack/react-query";

import { shouldRetryQuery } from "@/lib/query/api-error";

/**
 * How long a query's answer counts as current. Within it nothing refetches (quick back and
 * forth between screens costs nothing); past it, the query refetches as soon as its screen is
 * shown again: on mount, on a route change (`RefreshStaleOnNavigation`), on screen focus
 * (`useRefetchOnFocus`) and when the app returns to the foreground (`AuthProvider` drives the
 * focus manager from `AppState`). Data changed elsewhere — another device, another user — is
 * then at most this old on screen, and pull-to-refresh fetches it at once.
 */
export const DEFAULT_STALE_TIME_MS = 30_000;

/** The app's single query client. A factory so tests get the exact production defaults. */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        staleTime: DEFAULT_STALE_TIME_MS,
        // Explicit, not left to the library defaults: returning to the app (focus) and getting
        // the network back refetch what is on screen and stale.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  });
}
