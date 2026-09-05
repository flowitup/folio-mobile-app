/** Company join codes: 8 characters, no 0/O/1/I; shown grouped as XXXX-XXXX. */

export function normalizeJoinCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatJoinCode(raw: string): string {
  const code = normalizeJoinCode(raw).slice(0, 8);
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
