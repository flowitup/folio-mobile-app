import { useEffect } from "react";

const MINUTE_MS = 60_000;

/** Whole minutes left on a texted code (rounded up, so "1" during its last minute), 0 once it has run out. */
export function codeMinutesLeft(expiresAt: number, now: number): number {
  return Math.max(0, Math.ceil((expiresAt - now) / MINUTE_MS));
}

/**
 * Lifetime left on the code the backend texted, read from the screen's own clock (`now`, which
 * the screen refreshes when it sends a code). Wakes the screen through `tick` only when the minute
 * count changes and at expiry: a per-second ticker would re-render the code boxes under the
 * user's typing, and the label must not keep promising minutes after the code has expired.
 */
export function useCodeExpiry(
  expiresAt: number | null,
  now: number,
  tick: (now: number) => void,
): { minutesLeft: number; expired: boolean } {
  useEffect(() => {
    if (expiresAt === null) return;
    const left = expiresAt - now;
    if (left <= 0) return;
    const timer = setTimeout(
      () => tick(Date.now()),
      left % MINUTE_MS || MINUTE_MS,
    );
    return () => clearTimeout(timer);
  }, [expiresAt, now, tick]);

  const minutesLeft = expiresAt === null ? 0 : codeMinutesLeft(expiresAt, now);
  return { minutesLeft, expired: expiresAt !== null && minutesLeft === 0 };
}
