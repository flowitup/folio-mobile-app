/**
 * Pure helpers for the `@folio` mention: whether a draft/body addresses the assistant, and how
 * to split a string into plain/highlighted segments for rendering. Kept dependency-free (no
 * React, no API client) so they are trivial to unit test, and the detection regex mirrors the
 * backend's `(^|\s)@folio\b` (case-insensitive) so a highlighted bubble always matches what
 * actually dispatched the assistant.
 */

const MENTION_PATTERN = /(^|\s)@folio\b/i;
const MENTION_PATTERN_GLOBAL = /(^|\s)(@folio)\b/gi;

/** Whether `text` contains a `@folio` token (any case), the send-time trigger for the assistant. */
export function mentionsAssistant(text: string): boolean {
  return MENTION_PATTERN.test(text);
}

export interface MentionSegment {
  text: string;
  mention: boolean;
}

/**
 * Splits `text` into segments so a renderer can highlight the `@folio` token(s) while leaving
 * everything else untouched. Preserves the original text verbatim (including the mention's own
 * casing); returns a single non-mention segment when there is nothing to highlight.
 */
export function splitMention(text: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let lastIndex = 0;
  // A fresh RegExp per call: a shared module-level global regex would carry `lastIndex` state
  // across calls and silently skip matches on the second invocation.
  const pattern = new RegExp(MENTION_PATTERN_GLOBAL);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const leading = match[1];
    const token = match[2];
    const mentionStart = match.index + leading.length;
    const mentionEnd = mentionStart + token.length;
    if (mentionStart > lastIndex)
      segments.push({
        text: text.slice(lastIndex, mentionStart),
        mention: false,
      });
    segments.push({
      text: text.slice(mentionStart, mentionEnd),
      mention: true,
    });
    lastIndex = mentionEnd;
  }
  if (lastIndex < text.length || segments.length === 0)
    segments.push({ text: text.slice(lastIndex), mention: false });
  return segments;
}
