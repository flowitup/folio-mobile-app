/** Numeric parts of an "x.y.z" version; a missing or non-numeric part counts as 0. */
function parts(version: string): number[] {
  return version
    .trim()
    .split(".")
    .map((part) => {
      const n = parseInt(part, 10);
      return Number.isFinite(n) ? n : 0;
    });
}

/** Negative when `a` is older than `b`, 0 when equal, positive when newer. */
export function compareVersions(a: string, b: string): number {
  const left = parts(a);
  const right = parts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Whether this build must update. An empty minimum means "no gate", and a build whose own
 * version is unknown is never blocked: the gate must not lock people out by mistake.
 */
export function isBelowMinimum(
  current: string | undefined,
  minimum: string,
): boolean {
  if (!current || !minimum.trim()) return false;
  return compareVersions(current, minimum) < 0;
}
