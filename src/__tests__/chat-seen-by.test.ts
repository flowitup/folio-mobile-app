import { seenByMessage } from "@/lib/chat/seen-by";

const msg = (id: string, iso: string, sender: string) => ({
  id,
  created_at: iso,
  sender_id: sender,
});

const messages = [
  msg("m1", "2026-09-04T10:00:00+00:00", "alice"),
  msg("m2", "2026-09-04T10:05:00+00:00", "bob"),
  msg("m3", "2026-09-04T10:10:00+00:00", "alice"),
];

describe("seenByMessage", () => {
  it("places each reader under the newest message at or before their marker", () => {
    const seen = seenByMessage(
      messages,
      [
        { id: "bob", name: "Bob", last_read_at: "2026-09-04T10:07:00+00:00" },
        {
          id: "carol",
          name: "Carol",
          last_read_at: "2026-09-04T10:30:00+00:00",
        },
      ],
      "alice",
    );
    // Bob read up to m2, but m2 is his own message → nothing shown for him.
    expect(seen.get("m2")).toBeUndefined();
    expect(seen.get("m3")?.map((m) => m.id)).toEqual(["carol"]);
  });

  it("skips the viewer, members who never opened the channel, and markers before the first message", () => {
    const seen = seenByMessage(
      messages,
      [
        {
          id: "alice",
          name: "Alice",
          last_read_at: "2026-09-04T11:00:00+00:00",
        },
        { id: "dan", name: "Dan", last_read_at: null },
        { id: "eve", name: "Eve", last_read_at: "2026-09-04T09:00:00+00:00" },
      ],
      "alice",
    );
    expect(seen.size).toBe(0);
  });

  it("groups several readers under the same message", () => {
    const seen = seenByMessage(
      messages,
      [
        {
          id: "carol",
          name: "Carol",
          last_read_at: "2026-09-04T10:10:00+00:00",
        },
        { id: "dan", name: "Dan", last_read_at: "2026-09-04T12:00:00+00:00" },
      ],
      "alice",
    );
    expect(seen.get("m3")?.map((m) => m.name)).toEqual(["Carol", "Dan"]);
  });
});
