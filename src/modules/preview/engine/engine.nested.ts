import { MixCanvases } from "./engine.mix";
import type { NestedCanvas } from "./engine.types";

/**
 * The transparent canvases composition clips are drawn into, one per placement on screen. Default
 * (accelerated) 2D canvases: never `willReadFrequently`, which draws video frames black on
 * WebKitGTK.
 */
export class NestedCanvases {
  private readonly canvases = new Map<string, NestedCanvas>();

  /** The placement's canvas, cleared and at this size. */
  take(path: string, width: number, height: number): NestedCanvas {
    let nested = this.canvases.get(path);
    if (!nested) {
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) throw new Error("2D canvas is not available");
      nested = { ctx, mix: new MixCanvases(ctx.canvas) };
      this.canvases.set(path, nested);
    }
    const { ctx } = nested;
    if (ctx.canvas.width !== width) ctx.canvas.width = width;
    if (ctx.canvas.height !== height) ctx.canvas.height = height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return nested;
  }

  /** Lets go of placements no longer on screen. */
  release(needed: ReadonlySet<string>): void {
    for (const [path, nested] of this.canvases) {
      if (needed.has(path)) continue;
      this.drop(nested);
      this.canvases.delete(path);
    }
  }

  dispose(): void {
    this.release(new Set());
  }

  private drop({ ctx, mix }: NestedCanvas): void {
    mix.dispose();
    ctx.canvas.width = 0;
    ctx.canvas.height = 0;
  }
}
