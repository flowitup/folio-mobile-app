/**
 * Day helpers shared by the attendance screens (manager tab and worker mode).
 *
 * Two rules live here because both screens pair a month stepper with a single selected day:
 * - the selected day always belongs to the viewed month, so stepping to another month never
 *   leaves the day card showing — or logging — a day outside it;
 * - a worker may only self-log inside the backend's backdate window.
 */

/** Backend default (`SELF_ATTENDANCE_MAX_BACKDATE_DAYS`): a worker may self-log today − 31 at the oldest. */
export const SELF_ATTENDANCE_MAX_BACKDATE_DAYS = 31;

/** `YYYY-MM-DD` shifted by `days`, in local calendar arithmetic. */
function shiftDay(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** The day a freshly viewed month opens on: today while viewing the current month, else its 1st. */
export function defaultDayOfMonth(month: string, today: string): string {
  return today.slice(0, 7) === month ? today : `${month}-01`;
}

/**
 * The day to show for `month`: the one the user picked while it belongs to that month,
 * otherwise the month's default. Derived on every render instead of reset in an effect.
 */
export function dayInMonth(
  picked: string | null,
  month: string,
  today: string,
): string {
  return picked && picked.slice(0, 7) === month
    ? picked
    : defaultDayOfMonth(month, today);
}

/** Oldest day a worker may still self-log, inclusive. */
export function earliestSelfLogDay(today: string): string {
  return shiftDay(today, -SELF_ATTENDANCE_MAX_BACKDATE_DAYS);
}

/** Whether `day` sits inside the self-log window (not in the future, not past the backdate limit). */
export function canSelfLogDay(day: string, today: string): boolean {
  return day <= today && day >= earliestSelfLogDay(today);
}
