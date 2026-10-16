import { QueryClientContext } from "@tanstack/react-query";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { RefreshControl } from "react-native";
import type { RefreshControlProps } from "react-native";

import { INK_BLOCK, useTokens } from "@/theme/tokens";

/** Something to re-read on a pull: a query's `refetch`, `refreshUser`… Falsy entries are skipped. */
export type Refresher = (() => unknown) | null | undefined | false;

/**
 * Refetches, right away and whatever their stale time, the queries on screen under each key
 * (`["projects"]`: the project list and every query of the project shown), and runs the extra
 * refreshers. Settles when all of them have, failed or not: one failing read (offline, a 403 on
 * a section the user just lost) must neither keep the spinner turning nor stop the others.
 */
export async function runPullRefresh(
  queryClient: QueryClient | undefined,
  keys: readonly QueryKey[],
  refreshers: readonly Refresher[] = [],
): Promise<void> {
  await Promise.allSettled([
    ...(queryClient
      ? keys.map((queryKey) =>
          queryClient.refetchQueries({ queryKey, type: "active" }),
        )
      : []),
    ...refreshers
      .filter(
        (refresh): refresh is () => unknown => typeof refresh === "function",
      )
      .map(async (refresh) => refresh()),
  ]);
}

/**
 * Pull-to-refresh for a list screen: pass the result as the scroller's `refreshControl`.
 * Pulling re-reads what the screen shows — the active queries under `keys`, plus `refetch`
 * extras such as `refreshUser` where permissions decide what is offered — so a change made on
 * another device or by someone else shows without leaving the screen or restarting the app.
 *
 * The spinner follows the pull only, not background refetches (focus, foreground), which would
 * otherwise make the list jump down on their own.
 *
 * `onInk`: the scroller starts on the dark ink hero (`InkSheetScreen`), so the spinner is light.
 */
export function usePullToRefresh(
  keys: readonly QueryKey[],
  {
    refetch = [],
    onInk = false,
  }: { refetch?: readonly Refresher[]; onInk?: boolean } = {},
): ReactElement<RefreshControlProps> {
  // Read without `useQueryClient`, which throws outside a provider: screens rendered on their
  // own (tests with mocked queries) still get a working control.
  const queryClient = useContext(QueryClientContext);
  const tokens = useTokens();
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef({ keys, refetch });
  useEffect(() => {
    latest.current = { keys, refetch };
  });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runPullRefresh(
        queryClient,
        latest.current.keys,
        latest.current.refetch,
      );
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [queryClient]);

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={onInk ? INK_BLOCK.text : tokens.ink}
      colors={[tokens.ink]}
      progressBackgroundColor={tokens.paper}
    />
  );
}
