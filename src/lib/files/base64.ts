/**
 * Base64 for raw bytes (Hermes ships `btoa` but it only accepts a binary string).
 * Encodes in chunks so `String.fromCharCode` never receives a huge argument list.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
