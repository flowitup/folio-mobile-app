/**
 * Emoji reactions on chat messages: one per person per message, chosen from a fixed set.
 *
 * The server keeps the raw list (`{ user_id, emoji, created_at }`); everything shown on screen
 * (the chips under a bubble, who reacted with what, the optimistic toggle) is derived here.
 */

/** The six accepted emoji, in display order. ❤️ is U+2764 U+FE0F (emoji presentation). */
export const REACTION_EMOJIS = [
  "\u{1F44D}",
  "❤️",
  "\u{1F602}",
  "\u{1F62E}",
  "\u{1F622}",
  "\u{1F64F}",
] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface Reaction {
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ReactionCount {
  emoji: string;
  count: number;
  /** The viewer's own reaction is among them (its chip is highlighted). */
  mine: boolean;
}

/** Whether the server would accept this emoji (one of the fixed six, exact code points). */
export function isReactionEmoji(emoji: string): emoji is ReactionEmoji {
  return (REACTION_EMOJIS as readonly string[]).includes(emoji);
}

/** Display rank of an emoji: the fixed order, anything unknown after it. */
function rank(emoji: string): number {
  const index = (REACTION_EMOJIS as readonly string[]).indexOf(emoji);
  return index === -1 ? REACTION_EMOJIS.length : index;
}

/** One chip per emoji used on the message, in the fixed emoji order. */
export function reactionCounts(
  reactions: readonly Reaction[] | null | undefined,
  viewerId: string | null | undefined,
): ReactionCount[] {
  const byEmoji = new Map<string, ReactionCount>();
  for (const reaction of reactions ?? []) {
    const entry = byEmoji.get(reaction.emoji) ?? {
      emoji: reaction.emoji,
      count: 0,
      mine: false,
    };
    entry.count += 1;
    if (viewerId && reaction.user_id === viewerId) entry.mine = true;
    byEmoji.set(reaction.emoji, entry);
  }
  // Stable sort: unknown emoji keep their first-seen order behind the fixed set.
  return [...byEmoji.values()].sort((a, b) => rank(a.emoji) - rank(b.emoji));
}

/** The viewer's emoji on the message, or `null`. */
export function ownReaction(
  reactions: readonly Reaction[] | null | undefined,
  viewerId: string | null | undefined,
): string | null {
  if (!viewerId) return null;
  return (reactions ?? []).find((r) => r.user_id === viewerId)?.emoji ?? null;
}

export type ReactionChange =
  { kind: "set"; emoji: string } | { kind: "remove" };

/**
 * What tapping `emoji` does for the viewer: the same emoji again removes it, any other one
 * replaces theirs. Returns the request to make and the list to show until the server answers.
 */
export function toggleReaction(
  reactions: readonly Reaction[] | null | undefined,
  viewerId: string,
  emoji: string,
  now: string,
): { change: ReactionChange; reactions: Reaction[] } {
  const current = reactions ?? [];
  const others = current.filter((r) => r.user_id !== viewerId);
  if (ownReaction(current, viewerId) === emoji)
    return { change: { kind: "remove" }, reactions: others };
  return {
    change: { kind: "set", emoji },
    reactions: [...others, { user_id: viewerId, emoji, created_at: now }],
  };
}

export interface ReactedEntry {
  userId: string;
  /** `null` when the person is no longer among the channel members. */
  name: string | null;
  emoji: string;
}

/** Who reacted with what, oldest reaction first, names looked up in the channel members. */
export function whoReacted(
  reactions: readonly Reaction[] | null | undefined,
  members: readonly { id: string; name: string }[],
): ReactedEntry[] {
  const names = new Map(members.map((m) => [m.id, m.name]));
  return [...(reactions ?? [])]
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .map((r) => ({
      userId: r.user_id,
      name: names.get(r.user_id) ?? null,
      emoji: r.emoji,
    }));
}
