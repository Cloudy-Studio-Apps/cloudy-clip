import { createLogger } from "@/core";
import { clipComposite } from "@/modules/project";
import { activeJunctions } from "../logic/junctions";
import { seededRandom } from "../logic/random";
import { landLayer } from "./engine.composite";
import type { ClipDrawer, EngineOptions, TrackFrame } from "./engine.types";

/**
 * Pooled full-frame offscreen canvases, sized like the main canvas: a junction's two pictures
 * before its `mix` combines them, its result when that blends, and a layer for a clip that doesn't
 * land plainly. Default (accelerated) 2D canvases: never `willReadFrequently`, which draws video
 * frames black on WebKitGTK.
 */
const log = createLogger("preview.mix");

export class MixCanvases {
  /** Whether a failing mix was already reported, so a broken plugin logs once, not every frame. */
  reported = false;
  private readonly contexts: Array<CanvasRenderingContext2D | undefined> = [];

  constructor(private readonly main: HTMLCanvasElement) {}

  /** The first picture's canvas (the left clip), cleared and sized like the main canvas. */
  a(): CanvasRenderingContext2D {
    return this.prepare(0);
  }

  /** The second picture's canvas (the right clip), cleared and sized like the main canvas. */
  b(): CanvasRenderingContext2D {
    return this.prepare(1);
  }

  /** A clip's picture before it lands with its blend mode and opacity. */
  layer(): CanvasRenderingContext2D {
    return this.prepare(2);
  }

  /** What a junction's `mix` draws when the result blends with what's under it. */
  result(): CanvasRenderingContext2D {
    return this.prepare(3);
  }

  dispose(): void {
    for (const ctx of this.contexts) {
      if (!ctx) continue;
      ctx.canvas.width = 0;
      ctx.canvas.height = 0;
    }
    this.contexts.length = 0;
  }

  private prepare(index: number): CanvasRenderingContext2D {
    let ctx = this.contexts[index];
    if (!ctx) {
      const created = document.createElement("canvas").getContext("2d");
      if (!created) throw new Error("2D canvas is not available");
      ctx = created;
      this.contexts[index] = ctx;
    }
    const { canvas } = ctx;
    if (canvas.width !== this.main.width) canvas.width = this.main.width;
    if (canvas.height !== this.main.height) canvas.height = this.main.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return ctx;
  }
}

/**
 * Draws one video track's clips onto `ctx`. Under a junction whose kind has a `mix`, the left and
 * right pictures are drawn into the offscreen canvases and the mix draws the result in the
 * track's place. Otherwise (no junction, no `mix`, a missing kind) clips draw in start order, so
 * the right one covers the left. Offscreen a picture has no backdrop, so each keeps only its
 * opacity there: when both clips share a mode, the mix's result lands with it, else as Normal.
 */
export function drawTrack(
  ctx: CanvasRenderingContext2D,
  { project, format, track, clips, time }: TrackFrame,
  canvases: MixCanvases,
  junctions: EngineOptions["junctions"],
  drawClip: ClipDrawer,
): void {
  const active = activeJunctions(project, track.id, time).find(
    (a) => junctions.get(a.junction.kind)?.definition.mix !== undefined,
  );
  const mix = active && junctions.get(active.junction.kind)?.definition.mix;
  for (const clip of clips) {
    if (!active || !mix) {
      drawClip(ctx, clip);
      continue;
    }
    const { junction, progress, elapsed } = active;
    if (clip.id === junction.leftClipId) continue;
    if (clip.id !== junction.rightClipId) {
      drawClip(ctx, clip);
      continue;
    }
    const left = project.clips[junction.leftClipId];
    const a = canvases.a();
    const b = canvases.b();
    if (left) drawClip(a, left, false);
    drawClip(b, clip, false);
    const mode = clipComposite(clip).mode;
    const blended = left !== undefined && mode !== "normal" && clipComposite(left).mode === mode;
    const target = blended ? canvases.result() : ctx;
    const props = junctions.resolve(junction, format);
    const kx = ctx.canvas.width / format.width;
    const ky = ctx.canvas.height / format.height;
    // A fresh generator each frame, seeded by the junction: the same noise on every frame.
    const env = { format, kx, ky, random: seededRandom(junction.id), elapsed };
    target.save();
    try {
      target.setTransform(1, 0, 0, 1, 0, 0);
      mix(target, a.canvas, b.canvas, progress, props, env);
    } catch (error) {
      if (!canvases.reported) {
        canvases.reported = true;
        log.error(
          `The "${junction.kind}" junction failed to mix; drawing the right clip over the left`,
          error,
        );
      }
      // Whatever the mix drew is undone by the restore below; show both pictures plainly.
      target.setTransform(1, 0, 0, 1, 0, 0);
      target.globalAlpha = 1;
      target.globalCompositeOperation = "source-over";
      target.drawImage(a.canvas, 0, 0);
      target.drawImage(b.canvas, 0, 0);
    } finally {
      target.restore();
    }
    if (blended) landLayer(ctx, target.canvas, { mode, opacity: 1 });
  }
}
