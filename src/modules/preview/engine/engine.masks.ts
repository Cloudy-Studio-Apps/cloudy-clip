import {
  type ClipMask,
  type ClipMatte,
  type MaskMapping,
  type MaskMode,
  type PictureSize,
  type TrackId,
} from "@/modules/project";
import { GpuUnavailable } from "../gpu/gpu.errors";
import { blurPasses, lumaAlphaPass, MAX_BLUR_SIGMA } from "../gpu/gpu.mask";
import type { GpuPass } from "../gpu/gpu.types";
import { rasterize } from "./engine.maskshapes";
import { ShrinkCanvas } from "./engine.shrink";
import type { MaskPainterOptions, MatteCut } from "./engine.types";

/** How a mask lands on those before it (an intersect's shape is inverted first). */
const COMBINE: Record<MaskMode, GlobalCompositeOperation> = {
  add: "source-over",
  subtract: "destination-out",
  intersect: "destination-out",
  difference: "xor",
};

/** A transparent 2D canvas. Never `willReadFrequently`: it draws video black on WebKitGTK. */
function context(): CanvasRenderingContext2D {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  return ctx;
}

/** `ctx` sized like `like`, cleared, with nothing set. */
function fit(ctx: CanvasRenderingContext2D, like: HTMLCanvasElement): CanvasRenderingContext2D {
  const { canvas } = ctx;
  if (canvas.width !== like.width) canvas.width = like.width;
  if (canvas.height !== like.height) canvas.height = like.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return ctx;
}

/**
 * Draws a clip's masks into one alpha canvas and turns a drawn matte track into the alpha it cuts
 * with. Shapes go on 2D canvases; feather and luma run on the engine's GPU runner. Without it, a
 * capture or an export (`strict`) throws, and the live preview draws hard edges and uses luma as
 * alpha, calling `onFailure`. Owns the canvases matte tracks are drawn into, never a
 * `MixCanvases` slot, since a junction being mixed may hold those.
 */
export class MaskPainter {
  private readonly m = context();
  private readonly s = context();
  private readonly shrink = new ShrinkCanvas(true);
  /** Matte tracks' canvases by placement path ("" for the top level), then track. */
  private readonly tracks = new Map<string, Map<TrackId, CanvasRenderingContext2D>>();

  constructor(private readonly options: MaskPainterOptions) {}

  /** Draws `masks` (live overrides merged) into an alpha canvas sized like `like`, or null when none is on. */
  masks(
    like: HTMLCanvasElement,
    masks: readonly ClipMask[],
    mapping: MaskMapping,
    kx: number,
    ky: number,
  ): HTMLCanvasElement | null {
    const on = masks.filter((mask) => mask.on !== false);
    const first = on[0];
    if (!first) return null;
    const m = fit(this.m, like);
    const s = fit(this.s, like);
    const { width, height } = m.canvas;
    // After Effects' rule: a first Subtract or Intersect cuts from everything.
    m.fillStyle = "#fff";
    if (first.mode === "subtract" || first.mode === "intersect") m.fillRect(0, 0, width, height);
    for (const mask of on) {
      rasterize(s, mask, mapping, kx, ky, (mask.invert === true) !== (mask.mode === "intersect"));
      // Feather is a radius of about 2 sigma, in picture px, scaled as the picture is on each axis.
      const sigmaX = (mask.feather / 2) * Math.abs(mapping.sx) * kx;
      const sigmaY = (mask.feather / 2) * Math.abs(mapping.sy) * ky;
      const shape = sigmaX > 0 || sigmaY > 0 ? this.blur(s.canvas, sigmaX, sigmaY) : s.canvas;
      m.globalAlpha = mask.opacity;
      m.globalCompositeOperation = COMBINE[mask.mode];
      m.drawImage(shape, 0, 0, width, height);
    }
    m.globalAlpha = 1;
    m.globalCompositeOperation = "source-over";
    return m.canvas;
  }

  /**
   * How a matte cuts, from its drawn track: the track itself (inverted alpha: `destination-out`),
   * or for luma the GPU's canvas, to be drawn before the runner's next `run`.
   */
  matte(track: HTMLCanvasElement, matte: ClipMatte): MatteCut {
    if (matte.by === "luma") {
      const size = { width: track.width, height: track.height };
      const alpha = this.run(track, size, [lumaAlphaPass(matte.invert === true)]);
      if (alpha) return { canvas: alpha, op: "destination-in" };
    }
    return { canvas: track, op: matte.invert ? "destination-out" : "destination-in" };
  }

  /** The canvas a matte track of the placement at `path` is drawn into: cleared, sized like `like`. */
  track(path: string, trackId: TrackId, like: HTMLCanvasElement): CanvasRenderingContext2D {
    let level = this.tracks.get(path);
    if (!level) this.tracks.set(path, (level = new Map()));
    let ctx = level.get(trackId);
    if (!ctx) level.set(trackId, (ctx = context()));
    return fit(ctx, like);
  }

  /** Lets go of the matte canvases of placements no longer on screen. */
  release(placements: ReadonlySet<string>): void {
    for (const [path, level] of this.tracks) {
      if (path === "" || placements.has(path)) continue;
      for (const ctx of level.values()) ctx.canvas.width = ctx.canvas.height = 0;
      this.tracks.delete(path);
    }
  }

  dispose(): void {
    this.release(new Set());
    for (const ctx of [this.m, this.s, ...(this.tracks.get("")?.values() ?? [])]) {
      ctx.canvas.width = ctx.canvas.height = 0;
    }
    this.tracks.clear();
    this.shrink.dispose();
  }

  /** `s` blurred on the GPU, shrunk first when a sigma is past `MAX_BLUR_SIGMA`; `s` on failure. */
  private blur(s: HTMLCanvasElement, sigmaX: number, sigmaY: number): CanvasImageSource {
    const fx = Math.max(1, Math.ceil(sigmaX / MAX_BLUR_SIGMA));
    const fy = Math.max(1, Math.ceil(sigmaY / MAX_BLUR_SIGMA));
    const full = { width: s.width, height: s.height };
    const size = {
      width: Math.max(1, Math.round(s.width / fx)),
      height: Math.max(1, Math.round(s.height / fy)),
    };
    const passes = blurPasses(sigmaX / fx, sigmaY / fy);
    return this.run(this.shrink.fit(s, full, size), size, passes) ?? s;
  }

  /** The runner's canvas after `passes`; null in the live preview when the GPU failed. */
  private run(
    source: HTMLCanvasElement,
    size: PictureSize,
    passes: readonly GpuPass[],
  ): HTMLCanvasElement | null {
    try {
      if (!this.options.gpu) throw new GpuUnavailable();
      return this.options.gpu.run(source, size, passes);
    } catch (error) {
      if (this.options.strict) throw error instanceof Error ? error : new Error(String(error));
      this.options.onFailure(error);
      return null;
    }
  }
}
