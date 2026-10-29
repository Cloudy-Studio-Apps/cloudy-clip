/** Colors kept in the picker's "Recent" row. */
export const MAX_RECENT_COLORS = 12;

/** `list` with `color` first: a repeat moves to the front (case ignored), and the list is capped at `max`. */
export function pushRecent(
  list: readonly string[],
  color: string,
  max = MAX_RECENT_COLORS,
): string[] {
  const lower = color.toLowerCase();
  return [lower, ...list.filter((item) => item.toLowerCase() !== lower)].slice(0, max);
}
