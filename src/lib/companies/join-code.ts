/** Company join codes: 8 characters, no 0/O/1/I; shown grouped as XXXX-XXXX. */

export function normalizeJoinCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatJoinCode(raw: string): string {
  const code = normalizeJoinCode(raw).slice(0, 8);
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

const CODE_CHAR = "[A-HJ-NP-Z2-9]";
const GROUPED = new RegExp(
  `(?:^|[^A-Z0-9])(${CODE_CHAR}{4}-${CODE_CHAR}{4})(?![A-Z0-9])`,
);
const BARE = new RegExp(`(?:^|[^A-Z0-9])(${CODE_CHAR}{8})(?![A-Z0-9])`);

/**
 * The join code inside a pasted share message ("Rejoignez Bati Sud sur Folio : … le code
 * entreprise K7Q2-M9XR."), or null when the text holds none. A bare paste of the code itself
 * is left to `normalizeJoinCode`.
 */
export function extractJoinCode(text: string): string | null {
  const upper = text.toUpperCase();
  const match = GROUPED.exec(upper) ?? BARE.exec(upper);
  return match ? match[1] : null;
}
