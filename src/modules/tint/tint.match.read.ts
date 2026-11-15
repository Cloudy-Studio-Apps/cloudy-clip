import { CommandFailure } from "@/core";
import {
  animatedClip,
  clipEnd,
  gradeOf,
  type Clip,
  type ClipGrade,
  type Correction,
  type GradeNodeId,
  type ProjectState,
} from "@/modules/project";
import { correctionInput, evaluatePixel, finishCorrection } from "./logic/color/evaluate";
import { frameSamples, sourceAt } from "./logic/pick";
import { emptyGrade } from "./logic/stack";
import { insertLayer } from "./logic/stack.edit";
import type {
  FramePoint,
  MatchRead,
  NodeSample,
  Rgb,
  SourceSample,
  StackPosition,
} from "./tint.types";

// What `tint.match` reads from the frames it captured: the samples through a grade, the shown
// grade at the read's time, and where a new correction goes.

/** A `tint.*` command failure. */
export const fail = (code: string, message: string) => new CommandFailure(`tint.${code}`, message);

/** `time` when the clip holds it, else its middle. */
export const timeIn = (clip: Clip, time: number) =>
  time >= clip.start && time < clipEnd(clip)
    ? time
    : clip.start + Math.floor((clipEnd(clip) - clip.start) / 2);

/** A grade with an empty correction added at `place`, in the stored and the shown grade alike. */
export function withNew(
  grade: ClipGrade | null,
  place: StackPosition,
  id: GradeNodeId,
  name?: string,
) {
  const node: Correction = {
    kind: "correct",
    input: { node: "source" },
    on: true,
    opacity: 1,
    ...(name ? { name } : {}),
  };
  try {
    return insertLayer(grade ?? emptyGrade(), place, id, node);
  } catch {
    throw fail(
      "sealed",
      "There is no place for the new correction there: that part of the grade is a sealed card.",
    );
  }
}

/** Colors of the frame's samples through `grade` before `stopAt` (the whole grade without it). */
export function through(
  read: MatchRead,
  grade: ClipGrade,
  samples = frameSamples(read.frame.frame, read.frame.placement),
  stopAt?: GradeNodeId,
) {
  const { videoRange, lutOf } = read.frame;
  return samples.map((s) => ({
    rgb: evaluatePixel(grade, s.rgb, s.at, stopAt, videoRange, lutOf),
    at: s.at,
  }));
}

/**
 * Samples as correction `id` of `grade` gets them (`correctionInput`: its input and key), each with
 * the mix that takes a candidate result to what the correction draws (`finishCorrection`: its LUT,
 * opacity and key). Where it doesn't draw (off, opacity 0), the mix is the input as it is.
 */
export function nodeSamples(
  read: MatchRead,
  grade: ClipGrade,
  id: GradeNodeId,
  samples: readonly SourceSample[],
): NodeSample[] {
  const { videoRange, lutOf } = read.frame;
  const node = grade.nodes[id] as Correction;
  return samples.map(({ rgb, at }) => {
    const seen = correctionInput(grade, rgb, at, id, videoRange, lutOf);
    if (!seen) {
      const input = evaluatePixel(grade, rgb, at, id, videoRange, lutOf);
      return { rgb: input, at, mix: () => input };
    }
    return {
      rgb: seen.input,
      at,
      mix: (corrected) => finishCorrection(node, seen.input, corrected, seen.key, lutOf),
    };
  });
}

/** The clip's grade as shown at the read's time (keyed values there), from the fresh state. */
export const shownAt = (state: ProjectState, read: MatchRead) =>
  gradeOf(animatedClip(state.clips[read.clipId]!, read.time));

/** A patch's mean color coming into the chart correction; throws when a read is off the picture. */
export function patchMean(
  read: MatchRead,
  grade: ClipGrade,
  id: GradeNodeId,
  points: FramePoint[],
): Rgb {
  const samples = points.map((p) => sourceAt(read.frame.frame, p, read.frame.placement));
  if (samples.some((s) => s === null)) {
    throw fail("no_picture", "The chart reaches off the clip's picture.");
  }
  const colors = through(read, grade, samples as NonNullable<(typeof samples)[number]>[], id);
  const sum: Rgb = [0, 0, 0];
  for (const { rgb } of colors)
    for (const c of [0, 1, 2] as const) sum[c] += rgb[c] / colors.length;
  return sum;
}
