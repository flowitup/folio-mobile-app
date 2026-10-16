import { mergeHistory, slidOut } from "@/lib/chat/merge-history";

const m = (id: string, minute: number, body = id) => ({
  id,
  body,
  created_at: new Date(Date.UTC(2026, 9, 1, 8, minute)).toISOString(),
});

describe("mergeHistory", () => {
  it("joins older pages and the newest page oldest first, each message once", () => {
    const merged = mergeHistory(
      [m("a", 1), m("b", 2), m("c", 3, "old copy")],
      [m("c", 3, "new copy"), m("d", 4)],
    );
    expect(merged.map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
    expect(merged[2].body).toBe("new copy");
  });
});

describe("slidOut", () => {
  it("keeps what newer messages pushed out of the newest page", () => {
    expect(
      slidOut([m("a", 1), m("b", 2), m("c", 3)], [m("b", 2), m("c", 3), m("d", 4)]).map(
        (x) => x.id,
      ),
    ).toEqual(["a"]);
  });

  it("drops nothing newer than the page (a message deleted or hidden there stays gone)", () => {
    expect(slidOut([m("a", 1), m("x", 5)], [m("a", 1), m("d", 4)])).toEqual([]);
    expect(slidOut([m("a", 1)], [])).toEqual([]);
  });
});
