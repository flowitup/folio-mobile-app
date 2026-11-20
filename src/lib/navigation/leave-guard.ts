/**
 * One screen at a time can hold back a navigation that would throw away what the user typed.
 * `usePreventRemove` only sees a screen being removed; leaving through the shared header's back
 * arrow onto another tab (tabs keep a history) or tapping another tab removes nothing, so those
 * paths ask this guard first.
 */
type LeaveGuard = (proceed: () => void) => boolean;

let current: LeaveGuard | null = null;

/** Installs `guard`; the returned function removes it (only if it is still the active one). */
export function setLeaveGuard(guard: LeaveGuard): () => void {
  current = guard;
  return () => {
    if (current === guard) current = null;
  };
}

/** True when a guard took over: it will call `proceed` itself if the user agrees to leave. */
export function interceptLeave(proceed: () => void): boolean {
  return current ? current(proceed) : false;
}
