/**
 * Older pages of a thread joined with its polled newest page: one list, oldest first, each
 * message once (the newest page's copy wins, it carries the latest reactions).
 */
export function mergeHistory<T extends { id: string; created_at: string }>(
  older: readonly T[],
  newest: readonly T[],
): T[] {
  const byId = new Map<string, T>();
  for (const message of older) byId.set(message.id, message);
  for (const message of newest) byId.set(message.id, message);
  return [...byId.values()].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
  );
}

/**
 * Messages of the previous newest page that the new one no longer holds because newer messages
 * pushed them out, kept so a reader who loaded older history sees no gap.
 */
export function slidOut<T extends { id: string; created_at: string }>(
  previous: readonly T[],
  next: readonly T[],
): T[] {
  if (next.length === 0) return [];
  const oldestKept = Date.parse(next[0].created_at);
  const ids = new Set(next.map((message) => message.id));
  return previous.filter(
    (message) =>
      !ids.has(message.id) && Date.parse(message.created_at) <= oldestKept,
  );
}
