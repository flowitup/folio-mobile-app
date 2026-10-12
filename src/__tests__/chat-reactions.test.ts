import {
  REACTION_EMOJIS,
  isReactionEmoji,
  ownReaction,
  reactionCounts,
  toggleReaction,
  whoReacted,
} from "@/lib/chat/reactions";

const [THUMBS, HEART, JOY] = REACTION_EMOJIS;
const at = (minute: number) =>
  `2026-09-04T10:${String(minute).padStart(2, "0")}:00+00:00`;
const reaction = (user: string, emoji: string, minute = 0) => ({
  user_id: user,
  emoji,
  created_at: at(minute),
});

describe("REACTION_EMOJIS", () => {
  it("holds the six accepted emoji with their exact code points", () => {
    expect(
      REACTION_EMOJIS.map((emoji) =>
        [...emoji].map((c) => c.codePointAt(0)?.toString(16)),
      ),
    ).toEqual([
      ["1f44d"],
      ["2764", "fe0f"],
      ["1f602"],
      ["1f62e"],
      ["1f622"],
      ["1f64f"],
    ]);
  });

  it("rejects a heart without the emoji presentation selector", () => {
    expect(isReactionEmoji(HEART)).toBe(true);
    expect(isReactionEmoji("❤")).toBe(false);
  });
});

describe("reactionCounts", () => {
  it("aggregates by emoji in the fixed order and flags the viewer's own", () => {
    expect(
      reactionCounts(
        [
          reaction("bob", JOY),
          reaction("me", THUMBS),
          reaction("ann", JOY),
          reaction("cat", THUMBS),
        ],
        "me",
      ),
    ).toEqual([
      { emoji: THUMBS, count: 2, mine: true },
      { emoji: JOY, count: 2, mine: false },
    ]);
  });

  it("puts an unknown emoji after the fixed set and handles a missing list", () => {
    expect(
      reactionCounts([reaction("a", "🔥"), reaction("b", HEART)], null),
    ).toEqual([
      { emoji: HEART, count: 1, mine: false },
      { emoji: "🔥", count: 1, mine: false },
    ]);
    expect(reactionCounts(undefined, "me")).toEqual([]);
  });
});

describe("ownReaction", () => {
  it("finds the viewer's emoji or returns null", () => {
    const list = [reaction("bob", JOY), reaction("me", HEART)];
    expect(ownReaction(list, "me")).toBe(HEART);
    expect(ownReaction(list, "cat")).toBeNull();
    expect(ownReaction(list, undefined)).toBeNull();
  });
});

describe("toggleReaction", () => {
  const now = at(30);

  it("adds the viewer's first reaction", () => {
    expect(toggleReaction([reaction("bob", JOY)], "me", HEART, now)).toEqual({
      change: { kind: "set", emoji: HEART },
      reactions: [reaction("bob", JOY), reaction("me", HEART, 30)],
    });
  });

  it("swaps the viewer's reaction for another emoji (one per person)", () => {
    const next = toggleReaction(
      [reaction("me", THUMBS), reaction("bob", JOY)],
      "me",
      HEART,
      now,
    );
    expect(next.change).toEqual({ kind: "set", emoji: HEART });
    expect(next.reactions).toEqual([
      reaction("bob", JOY),
      reaction("me", HEART, 30),
    ]);
  });

  it("removes the viewer's reaction when the same emoji is tapped again", () => {
    expect(
      toggleReaction(
        [reaction("me", THUMBS), reaction("bob", THUMBS)],
        "me",
        THUMBS,
        now,
      ),
    ).toEqual({
      change: { kind: "remove" },
      reactions: [reaction("bob", THUMBS)],
    });
  });

  it("never touches someone else's reaction", () => {
    const next = toggleReaction([reaction("bob", THUMBS)], "me", THUMBS, now);
    expect(next.change).toEqual({ kind: "set", emoji: THUMBS });
    expect(next.reactions).toHaveLength(2);
  });
});

describe("whoReacted", () => {
  it("lists names with their emoji, oldest first, null for a former member", () => {
    expect(
      whoReacted(
        [
          reaction("bob", JOY, 5),
          reaction("gone", HEART, 1),
          reaction("ann", THUMBS, 3),
        ],
        [
          { id: "ann", name: "Ann" },
          { id: "bob", name: "Bob" },
        ],
      ),
    ).toEqual([
      { userId: "gone", name: null, emoji: HEART },
      { userId: "ann", name: "Ann", emoji: THUMBS },
      { userId: "bob", name: "Bob", emoji: JOY },
    ]);
  });
});
