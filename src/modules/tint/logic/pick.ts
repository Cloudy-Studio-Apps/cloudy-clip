import type { ClipGrade, ClipPlacement, GradeNodeId } from "@/modules/project";
import type { FramePoint, LutLookup, PickFrame, PixelAt, Rgb, SourceSample } from "../tint.types";
import { evaluatePixel } from "./color/evaluate";

/** The color around pixel `(x, y)` of a frame: the mean of up to 3 × 3 pixels, 0…1. */
export function meanAround(frame: PickFrame, x: number, y: number): Rgb {
  const sum: Rgb = [0, 0, 0];
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || py < 0 || px >= frame.width || py >= frame.height) continue;
      const i = (py * frame.width + px) * 4;
      sum[0] += frame.data[i]!;
      sum[1] += frame.data[i + 1]!;
      sum[2] += frame.data[i + 2]!;
      n++;
    }
  }
  return n === 0 ? sum : [sum[0] / n / 255, sum[1] / n / 255, sum[2] / n / 255];
}

/**
 * Where a point of the frame (output pixels, y down) is in a clip's own picture, as `v_uv` has it
 * (`u` 0 left to 1 right, `v` 0 bottom to 1 top), undoing the placement's move, size and clockwise
 * rotation and its flip, with the picture's aspect. Outside 0…1 when the point is off the picture.
 */
export function pictureAt(placement: ClipPlacement, x: number, y: number): PixelAt {
  const turn = (placement.rotation * Math.PI) / 180;
  const dx = x - placement.cx;
  const dy = y - placement.cy;
  const lx = dx * Math.cos(turn) + dy * Math.sin(turn);
  const ly = -dx * Math.sin(turn) + dy * Math.cos(turn);
  const u = lx / placement.width + 0.5;
  const v = 0.5 - ly / placement.height;
  return {
    u: placement.flipX ? 1 - u : u,
    v: placement.flipY ? 1 - v : v,
    aspect: placement.width / placement.height,
  };
}

/**
 * The color a correction reads at a point of the frame: the clip's own ungraded picture there
 * (`frame`, the clip captured alone without filters, the size of the composition's frame), run
 * through the corrections before `nodeId` with the CPU reference (`evaluatePixel`). `nodeId` null
 * (no correction yet) runs the whole grade, as a new correction goes below the others. With a
 * placement, a point off the clip's picture gives null; without one (size unknown) the point is
 * read where it is and `at` is the frame's own. `videoRange` is the clip's (`tint.range.ts`), for
 * the grade's input conversion; `lutOf` finds the corrections' LUTs.
 */
export function pickAt(
  frame: PickFrame,
  point: FramePoint,
  grade: ClipGrade | null,
  nodeId: GradeNodeId | null,
  placement: ClipPlacement | null,
  videoRange = true,
  lutOf?: LutLookup,
): Rgb | null {
  const sample = sourceAt(frame, point, placement);
  if (!sample) return null;
  const { rgb, at } = sample;
  return grade ? evaluatePixel(grade, rgb, at, nodeId ?? undefined, videoRange, lutOf) : rgb;
}

/**
 * The clip's own ungraded color around a point of the frame (`meanAround`) and where that is in its
 * picture (`pictureAt`). With a placement, a point off the picture gives null; without one, `at`
 * is the frame's own.
 */
export function sourceAt(
  frame: PickFrame,
  point: FramePoint,
  placement: ClipPlacement | null,
): SourceSample | null {
  const x = Math.min(frame.width - 1, Math.max(0, Math.floor(point.u * frame.width)));
  const y = Math.min(frame.height - 1, Math.max(0, Math.floor(point.v * frame.height)));
  let at: PixelAt = { u: point.u, v: 1 - point.v, aspect: frame.width / frame.height };
  if (placement) {
    at = pictureAt(placement, point.u * frame.width, point.v * frame.height);
    if (at.u < 0 || at.u > 1 || at.v < 0 || at.v > 1) return null;
  }
  return { rgb: meanAround(frame, x, y), at };
}

/**
 * Pixels of the clip's picture spread evenly over the frame, at most about `most` of them (the
 * statistics of auto balance and shot match): each its own color and where it is, off-picture
 * ones left out.
 */
export function frameSamples(
  frame: PickFrame,
  placement: ClipPlacement | null,
  most = 2400,
): SourceSample[] {
  const step = Math.max(1, Math.sqrt((frame.width * frame.height) / most));
  const out: SourceSample[] = [];
  for (let y = step / 2; y < frame.height; y += step) {
    for (let x = step / 2; x < frame.width; x += step) {
      const sample = sourceAt(frame, { u: x / frame.width, v: y / frame.height }, placement);
      if (sample) out.push(sample);
    }
  }
  return out;
}
