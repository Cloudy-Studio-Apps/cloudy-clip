/** Whether a `left`/`right`/`up`/`down` direction moves along the vertical axis. */
export function isVertical(direction: unknown): boolean {
  return direction === "up" || direction === "down";
}

/**
 * Where a picture sits after moving `amount` frames (1 is one whole frame) the way `direction`
 * goes (`left`, `right`, `up`, `down`; anything else is `left`), as a canvas offset `[x, y]`.
 */
export function directionOffset(
  direction: unknown,
  width: number,
  height: number,
  amount: number,
): [number, number] {
  const sign = direction === "right" || direction === "down" ? 1 : -1;
  return isVertical(direction) ? [0, amount * height * sign] : [amount * width * sign, 0];
}
