import type { ClipGrade, ClipPlacement, GradeNodeId } from "@/modules/project";
import type { FramePoint, PickFrame, PixelAt, Rgb } from "../tint.types";
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
 * rotation, with the picture's aspect. Outside 0…1 when the point is off the picture.
 */
export function pictureAt(placement: ClipPlacement, x: number, y: number): PixelAt {
  const turn = (placement.rotation * Math.PI) / 180;
  const dx = x - placement.cx;
  const dy = y - placement.cy;
  const lx = dx * Math.cos(turn) + dy * Math.sin(turn);
  const ly = -dx * Math.sin(turn) + dy * Math.cos(turn);
  return {
    u: lx / placement.width + 0.5,
    v: 0.5 - ly / placement.height,
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
 * the grade's input conversion.
 */
export function pickAt(
  frame: PickFrame,
  point: FramePoint,
  grade: ClipGrade | null,
  nodeId: GradeNodeId | null,
  placement: ClipPlacement | null,
  videoRange = true,
): Rgb | null {
  const x = Math.min(frame.width - 1, Math.max(0, Math.floor(point.u * frame.width)));
  const y = Math.min(frame.height - 1, Math.max(0, Math.floor(point.v * frame.height)));
  let at: PixelAt = { u: point.u, v: 1 - point.v, aspect: frame.width / frame.height };
  if (placement) {
    at = pictureAt(placement, point.u * frame.width, point.v * frame.height);
    if (at.u < 0 || at.u > 1 || at.v < 0 || at.v > 1) return null;
  }
  const source = meanAround(frame, x, y);
  return grade ? evaluatePixel(grade, source, at, nodeId ?? undefined, videoRange) : source;
}
