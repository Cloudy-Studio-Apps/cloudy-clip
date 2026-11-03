/**
 * Where a row dragged `dy` px from its place `from` lands in a list of `count` rows of
 * `rowHeight`: the position it moves to, as `sound.moveEffect` takes it.
 */
export function chainSlot(from: number, dy: number, rowHeight: number, count: number): number {
  return Math.min(count - 1, Math.max(0, from + Math.round(dy / rowHeight)));
}
