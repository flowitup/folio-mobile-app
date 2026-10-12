/**
 * "Seen" receipts: which members have read up to which message.
 *
 * Each member carries the read marker of the channel (`last_read_at`). A member is shown
 * once, under the newest message created at or before that marker — the Messenger
 * convention — and never under their own messages or for the viewer themself.
 */
import { dayKeyOf, timeOf } from "@/lib/chat/group-messages-by-day";
import { toIsoDate } from "@/lib/format/date";

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
 * details sheet: the sender is left out, readers come in the order they caught up.
 */
export function readersOfMessage<M extends SeenMember>(
  message: Pick<SeenMessage, "created_at" | "sender_id">,
  members: M[],
): MessageReader<M>[] {
  const createdAt = Date.parse(message.created_at);
  if (Number.isNaN(createdAt)) return [];
  const readers: { reader: MessageReader<M>; at: number }[] = [];
  for (const member of members) {
    if (!member.last_read_at || member.id === message.sender_id) continue;
    const at = Date.parse(member.last_read_at);
    if (Number.isNaN(at) || at < createdAt) continue;
    readers.push({ reader: { member, readAt: member.last_read_at }, at });
  }
  return readers.sort((a, b) => a.at - b.at).map((entry) => entry.reader);
}

/** When a reader caught up: `HH:mm` today, `dd/mm HH:mm` on an earlier day (local time). */
export function readAtLabel(iso: string, today: Date = new Date()): string {
  const day = dayKeyOf(iso);
  if (day === toIsoDate(today)) return timeOf(iso);
  return `${day.slice(8, 10)}/${day.slice(5, 7)} ${timeOf(iso)}`;
}
