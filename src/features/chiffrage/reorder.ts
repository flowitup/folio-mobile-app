/**
 * Turn a one-step ↑/↓ move into what the chiffrage reorder endpoints take.
 *
 * The backend places a moved item between the neighbour above (`beforeId`)
 * and the neighbour below (`afterId`) its new slot, so the neighbours are
 * read off the list as it will look after the move, not before (same
 * contract as the web's components/chiffrage/reorder.ts).
 */

export interface StepMove {
  beforeId: string | null;
  afterId: string | null;
}

/** Neighbours of the slot one step up or down; null when the item can't move. */
export function stepMove(
  items: readonly { id: string }[],
  index: number,
  direction: "up" | "down",
): StepMove | null {
  if (direction === "up") {
    if (index <= 0 || index >= items.length) return null;
    return {
      beforeId: items[index - 2]?.id ?? null,
      afterId: items[index - 1].id,
    };
  }
  if (index < 0 || index >= items.length - 1) return null;
  return {
    beforeId: items[index + 1].id,
    afterId: items[index + 2]?.id ?? null,
  };
}
