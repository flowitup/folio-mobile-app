/** Most extra hours one attendance row can carry (backend `supplement_hours`, 0 to 12). */
export const MAX_SUPPLEMENT_HOURS = 12;

/**
 * Reads typed extra hours: a whole number from 0 to 12, blank meaning 0.
 * Anything else ("1,5", "14") returns null so the form can refuse it instead of
 * silently saving another value.
 */
export function parseSupplementHours(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const hours = Number(trimmed);
  return hours <= MAX_SUPPLEMENT_HOURS ? hours : null;
}
