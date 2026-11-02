import type { VideoLevels } from "../preview.types";

/**
 * Gives a video frame back its full range, for a webview that squeezes it. Reading a frame back
 * is too slow to play, so only hidden renderers use this.
 */
export class LevelCorrection {
  private readonly table = new Uint8ClampedArray(256);
  private readonly canvas = document.createElement("canvas");
  private readonly ctx: CanvasRenderingContext2D;

  constructor({ black, white }: VideoLevels) {
    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas is not available");
    this.ctx = ctx;
    for (let value = 0; value < 256; value++) {
      this.table[value] = ((value - black) * 255) / (white - black);
    }
  }

  /** The frame on a canvas of its own, at its own size, corrected. */
  correct(element: HTMLVideoElement, width: number, height: number): HTMLCanvasElement {
    const { canvas, ctx, table } = this;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.drawImage(element, 0, 0, width, height);
    const frame = ctx.getImageData(0, 0, width, height);
    const { data } = frame;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = table[data[i]!]!;
      data[i + 1] = table[data[i + 1]!]!;
      data[i + 2] = table[data[i + 2]!]!;
    }
    ctx.putImageData(frame, 0, 0);
    return canvas;
  }
}
