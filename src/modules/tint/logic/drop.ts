import type { DropRow, StackPosition } from "../tint.types";

/** Where a dragged layer would land with the pointer at `y`, and the line to show there; null when that is where it is. */
export function dropAt(
  rows: readonly DropRow[],
  dragged: string,
  y: number,
): { to: StackPosition; lineY: number } | null {
  const from = rows.findIndex((row) => row.id === dragged);
  if (from < 0) return null;
  const others = rows.filter((row) => row.id !== dragged);
  const index = others.filter((row) => (row.top + row.bottom) / 2 < y).length;
  const next = others[index];
  const last = others[others.length - 1];
  if (index === from && (next || !rows[from]?.nested)) return null;
  if (next) return { to: { before: next.id }, lineY: next.top };
  return { to: {}, lineY: last ? last.bottom : 0 };
}
