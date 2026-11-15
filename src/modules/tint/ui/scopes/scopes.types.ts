/** Which scope a canvas draws. */
export type DrawnScope = "parade" | "wave" | "hist" | "vector";

/** Paints one scope: `(ctx, kind, frame, width, height, grid)`; `frame` null draws the graticule only. */
export type ScopePainter = (
  ctx: CanvasRenderingContext2D,
  kind: DrawnScope,
  frame: ImageData | null,
  width: number,
  height: number,
  grid: string,
) => void;

/** A running scopes loop. */
export interface ScopesLoop {
  /** Paints again (a size, scope or theme change) from the last frame read, without reading. */
  invalidate(): void;
  stop(): void;
}
