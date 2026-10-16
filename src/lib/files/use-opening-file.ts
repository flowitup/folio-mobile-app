import { useCallback, useRef, useState } from "react";

/**
 * Which row is opening a file, for its spinner: nothing shows while a file downloads before
 * the viewer opens, so without it a tap looks ignored. `run` ignores taps while one is busy.
 */
export function useOpeningFile(): {
  openingId: string | null;
  run: <T>(id: string, open: () => Promise<T>) => Promise<T | undefined>;
} {
  const [openingId, setOpeningId] = useState<string | null>(null);
  const busy = useRef(false);
  const run = useCallback(
    async <T>(id: string, open: () => Promise<T>): Promise<T | undefined> => {
      if (busy.current) return undefined;
      busy.current = true;
      setOpeningId(id);
      try {
        return await open();
      } finally {
        busy.current = false;
        setOpeningId(null);
      }
    },
    [],
  );
  return { openingId, run };
}
