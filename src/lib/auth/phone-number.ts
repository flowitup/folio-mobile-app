/**
 * Sign-in is French-only: the SMS code leaves through a French gateway, so the app takes what the
 * user types ("06 12 34 56 78", "6 12 34 56 78", "+33 6 12 34 56 78", "0033…") and turns it into E.164 so it can be
 * shown back and sent to the backend. A number from any other country is refused here, before a
 * code is ever requested.
 */

const FRENCH_E164 = /^\+33[1-9]\d{8}$/;
/** A French number written without its trunk 0, as the field's own `FR +33` chip invites. */
const FRENCH_NATIONAL = /^[1-9]\d{8}$/;

/** E.164 form of `raw` when it reads as a French phone number, or null when it does not. */
export function normalizePhone(raw: string): string | null {
  // "+33 (0)6 …": the bracketed trunk 0 is not dialled after the country code.
  const digits = raw
    .trim()
    .replace(/^(\+|00)\s*33\s*\(0\)/, "$133")
    .replace(/[\s().-]/g, "");
  if (!digits) return null;
  let candidate: string;
  if (digits.startsWith("00")) candidate = `+${digits.slice(2)}`;
  else if (digits.startsWith("+")) candidate = digits;
  else if (digits.startsWith("0")) candidate = `+33${digits.slice(1)}`;
  else if (FRENCH_NATIONAL.test(digits)) candidate = `+33${digits}`;
  // "33612345678": the country code typed without its "+".
  else if (/^33[1-9]\d{8}$/.test(digits)) candidate = `+${digits}`;
  else return null;
  // "+33 06 …": a trunk 0 kept after the country code.
  if (/^\+330[1-9]\d{8}$/.test(candidate))
    candidate = `+33${candidate.slice(4)}`;
  return FRENCH_E164.test(candidate) ? candidate : null;
}

/**
 * How a French number is written for people: "+33 6 12 34 56 78" (the digit after the country
 * code on its own, then pairs), the format the web uses. Anything else is returned as given.
 */
export function formatFrenchPhone(phone: string | null | undefined): string {
  const value = phone?.trim() ?? "";
  const e164 = normalizePhone(value);
  if (!e164) return value;
  const national = e164.slice(3);
  return `+33 ${national[0]} ${national.slice(1).replace(/(\d{2})(?=\d)/g, "$1 ")}`;
}
