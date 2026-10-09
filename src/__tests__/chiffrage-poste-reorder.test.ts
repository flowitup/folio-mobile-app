import { stepMove } from "@/features/chiffrage/reorder";

// The backend places the moved poste between `before_id` (above the new slot)
// and `after_id` (below it), so a one-step move must name the neighbours of
// the slot it lands in, not the ones it leaves.
const postes = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

describe("stepMove", () => {
  it("moves the last poste up between its two predecessors", () => {
    expect(stepMove(postes, 3, "up")).toEqual({ beforeId: "b", afterId: "c" });
  });

  it("moves the second poste up to the top", () => {
    expect(stepMove(postes, 1, "up")).toEqual({ beforeId: null, afterId: "a" });
  });

  it("moves the first poste down below the second", () => {
    expect(stepMove(postes, 0, "down")).toEqual({
      beforeId: "b",
      afterId: "c",
    });
  });

  it("moves the penultimate poste down to the bottom", () => {
    expect(stepMove(postes, 2, "down")).toEqual({
      beforeId: "d",
      afterId: null,
    });
  });

  it("refuses to move past either end", () => {
    expect(stepMove(postes, 0, "up")).toBeNull();
    expect(stepMove(postes, 3, "down")).toBeNull();
  });
});
