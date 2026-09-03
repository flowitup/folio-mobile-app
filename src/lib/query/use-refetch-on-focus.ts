import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

/**
 * Refetches a query every time the screen regains focus (tab switch, back navigation),
 * skipping the very first focus because the query already ran on mount.
 */
export function useRefetchOnFocus(refetch: () => unknown): void {
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void refetch();
    }, [refetch]),
  );
}
