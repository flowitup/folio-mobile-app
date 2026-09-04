/**
 * Mirror of the backend `normalize_phone`: what the user types ("06 12 34 56 78", "+84 912…")
 * becomes E.164 so the app can validate before asking for a code and show the number it sent to.
 * A leading 0 means a French number; other countries need their + prefix.
 */

const COUNTRY_CODES: Record<string, string> = { FR: "33", VN: "84" };
const E164 = /^\+[1-9]\d{7,14}$/;

/** E.164 form of `raw`, or null when it cannot be read as a phone number. */
export function normalizePhone(
  raw: string,
  defaultRegion = "FR",
): string | null {
  const digits = raw.trim().replace(/[\s().-]/g, "");
  if (!digits) return null;
  let candidate: string;
  if (digits.startsWith("00")) candidate = `+${digits.slice(2)}`;
  else if (digits.startsWith("+")) candidate = digits;
  else if (digits.startsWith("0")) {
    const country = COUNTRY_CODES[defaultRegion.toUpperCase()];
    if (!country) return null;
    candidate = `+${country}${digits.slice(1)}`;
  } else return null;
  return E164.test(candidate) ? candidate : null;
}
