import { activeJunctions } from "../logic/junctions";
import { seededRandom } from "../logic/random";
import type { ClipDrawer, EngineOptions, TrackFrame } from "./engine.types";

/**
 * Two pooled full-frame offscreen canvases, sized like the main canvas, that a junction's two
 * pictures are drawn into before its `mix` combines them. Default (accelerated) 2D canvases:
 * never `willReadFrequently`, which draws video frames black on WebKitGTK.
 */
export class MixCanvases {
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
 * the right one covers the left.
 */
export function drawTrack(
  ctx: CanvasRenderingContext2D,
  { project, track, clips, time }: TrackFrame,
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
    if (left) drawClip(a, left);
    drawClip(b, clip);
    const props = junctions.resolve(junction, project.format);
    const kx = ctx.canvas.width / project.format.width;
    const ky = ctx.canvas.height / project.format.height;
    // A fresh generator each frame, seeded by the junction: the same noise on every frame.
    const env = { format: project.format, kx, ky, random: seededRandom(junction.id), elapsed };
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    mix(ctx, a.canvas, b.canvas, progress, props, env);
    ctx.restore();
  }
}
