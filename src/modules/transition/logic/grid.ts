/** A grid of square blocks covering a frame. */
export interface BlockGrid {
  block: number;
  cols: number;
  rows: number;
}

/**
 * The grid for blocks of about `block` px over `width` x `height`; the block grows so that there
 * are at most `maxCells` cells.
 */
export function blockGrid(
  width: number,
  height: number,
  block: number,
  maxCells = 20000,
): BlockGrid {
  const floor = Math.ceil(Math.sqrt((width * height) / maxCells));
  const size = Math.max(1, Math.round(block), floor);
  return { block: size, cols: Math.ceil(width / size), rows: Math.ceil(height / size) };
}
