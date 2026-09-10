/**
 * Sign-in is French-only: the SMS code leaves through a French gateway, so the app takes what the
 * user types ("06 12 34 56 78", "+33 6 12 34 56 78", "0033…") and turns it into E.164 so it can be
 * shown back and sent to the backend. A number from any other country is refused here, before a
 * code is ever requested.
 */

const FRENCH_E164 = /^\+33[1-9]\d{8}$/;

/** E.164 form of `raw` when it reads as a French phone number, or null when it does not. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.trim().replace(/[\s().-]/g, "");
  if (!digits) return null;
  let candidate: string;
  if (digits.startsWith("00")) candidate = `+${digits.slice(2)}`;
  else if (digits.startsWith("+")) candidate = digits;
  else if (digits.startsWith("0")) candidate = `+33${digits.slice(1)}`;
  else return null;
  return FRENCH_E164.test(candidate) ? candidate : null;
}
