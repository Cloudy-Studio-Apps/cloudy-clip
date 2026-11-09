import type { PictureSize } from "@/modules/project";

/**
 * A 2D canvas a picture is drawn onto at a smaller size before it goes to the GPU, so the upload,
 * which is most of a pass's cost, stays small. One per engine, reused for every layer: its
 * picture is used (uploaded) before the next layer takes it. An `alpha` one keeps transparency
 * (images, placements); an opaque one is for video.
 */
export class ShrinkCanvas {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor(private readonly alpha = false) {}

  /** `source` drawn at `size` when that is smaller than its `full` size; else `source` itself. */
  fit<T extends TexImageSource & CanvasImageSource>(
    source: T,
    full: PictureSize,
    size: PictureSize,
  ): T | HTMLCanvasElement {
    if (size.width >= full.width && size.height >= full.height) return source;
    if (!this.canvas || !this.ctx) {
      this.canvas = document.createElement("canvas");
      this.ctx = this.canvas.getContext("2d", { alpha: this.alpha });
      if (!this.ctx) return source;
    }
    if (this.canvas.width !== size.width || this.canvas.height !== size.height) {
      this.canvas.width = size.width;
      this.canvas.height = size.height;
    }
    if (this.alpha) this.ctx.clearRect(0, 0, size.width, size.height);
    this.ctx.drawImage(source, 0, 0, size.width, size.height);
    return this.canvas;
  }

  dispose(): void {
    if (this.canvas) {
      this.canvas.width = 0;
      this.canvas.height = 0;
    }
    this.canvas = null;
    this.ctx = null;
  }
}
