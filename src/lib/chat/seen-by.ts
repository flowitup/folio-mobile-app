/**
 * "Seen" receipts: which members have read up to which message.
 *
 * Each member carries the read marker of the channel (`last_read_at`). A member is shown
 * once, under the newest message created at or before that marker — the Messenger
 * convention — and never under their own messages or for the viewer themself.
 */

export interface SeenMember {
  id: string;
  name: string;
  last_read_at?: string | null;
}

interface SeenMessage {
  id: string;
  created_at: string;
  /** `null` for a message without a member sender (never excluded as "its own sender"). */
  sender_id: string | null;
}

/** Message id → members whose read marker lands on that message (order = members order). */
export function seenByMessage<M extends SeenMember, T extends SeenMessage>(
  messages: T[],
  members: M[],
  viewerId: string | null | undefined,
): Map<string, M[]> {
  const result = new Map<string, M[]>();
  if (messages.length === 0) return result;
  for (const member of members) {
    if (!member.last_read_at || member.id === viewerId) continue;
    const readAt = Date.parse(member.last_read_at);
    if (Number.isNaN(readAt)) continue;
    // Newest message at or before the marker (messages arrive oldest → newest).
    let seen: T | undefined;
    for (const message of messages) {
      if (Date.parse(message.created_at) <= readAt) seen = message;
      else break;
    }
    if (!seen || seen.sender_id === member.id) continue;
    const list = result.get(seen.id) ?? [];
    list.push(member);
    result.set(seen.id, list);
  }
  return result;
}

export interface MessageReader<M extends SeenMember> {
  member: M;
  /** The member's read marker (`last_read_at`), i.e. when they had read up to this message. */
  readAt: string;
}

/**
 * Everyone who has read up to one message (their marker is at or after it), for the message
 * details sheet: the sender and the viewer are left out, readers come in the order they caught
 * up. A marker only says how far someone has read, not when they saw this message, so the
 * sheet shows names, not times.
 */
export function readersOfMessage<M extends SeenMember>(
  message: Pick<SeenMessage, "created_at" | "sender_id">,
  members: M[],
  viewerId?: string | null,
): MessageReader<M>[] {
  const createdAt = Date.parse(message.created_at);
  if (Number.isNaN(createdAt)) return [];
  const readers: { reader: MessageReader<M>; at: number }[] = [];
  for (const member of members) {
    if (
      !member.last_read_at ||
      member.id === message.sender_id ||
      member.id === viewerId
    )
      continue;
    const at = Date.parse(member.last_read_at);
    if (Number.isNaN(at) || at < createdAt) continue;
    readers.push({ reader: { member, readAt: member.last_read_at }, at });
  }
  return readers.sort((a, b) => a.at - b.at).map((entry) => entry.reader);
}
