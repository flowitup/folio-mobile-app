/** Longest recording the composer allows; keeps a voice note well inside the 10 MB API limit. */
export const MAX_RECORDING_MS = 5 * 60 * 1000;

/**
 * Whether a chat attachment is a recording rather than a picture. The API stores whatever
 * content type the recording device reported, so match the family instead of a fixed list.
 */
export function isVoiceNote(contentType: string): boolean {
  return contentType.toLowerCase().startsWith("audio/");
}

/** `m:ss` for a recorder or player position in milliseconds; negative and NaN read as `0:00`. */
export function formatClock(milliseconds: number): string {
  const total = Number.isFinite(milliseconds)
    ? Math.max(0, Math.floor(milliseconds / 1000))
    : 0;
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

/** Name a recording is uploaded under; the extension is what `expo-audio` records on both platforms. */
export function voiceNoteFilename(at: Date = new Date()): string {
  return `voice-${at.getTime()}.m4a`;
}

/** Fraction of the way through a voice note, clamped to 0..1 for the progress bar. */
export function playbackFraction(
  positionMs: number,
  durationMs: number,
): number {
  if (!Number.isFinite(positionMs) || !Number.isFinite(durationMs)) return 0;
  if (durationMs <= 0) return 0;
  return Math.min(1, Math.max(0, positionMs / durationMs));
}
