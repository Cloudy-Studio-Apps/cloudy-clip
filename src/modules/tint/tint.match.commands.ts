import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import { previewRef } from "@/modules/preview";
import {
  correctionOf,
  projectRef,
  type ClipGrade,
  type Correction,
  type CorrectionValues,
  type GradeNodeId,
} from "@/modules/project";
import { CHART_REFERENCE, chartValues, patchPoints, quadArea } from "./logic/chart";
import { luma } from "./logic/color/basics";
import { balanceValues, currentCorrection, nextMatchName, shotValues } from "./logic/match";
import { sourceAt } from "./logic/pick";
import { emptyGrade, toStack } from "./logic/stack";
import { checkedGrade, readGrade, writeGrade } from "./tint.guards";
import { refuseUnlessEditable } from "./tint.node.commands";
import { tintRef } from "./tint.ref";
import { fail, patchMean, shownAt, through, timeIn, withNew } from "./tint.match.read";
import type { MatchKind, MatchRead } from "./tint.types";

const KINDS = ["auto", "white", "gray", "shot", "chart"] as const satisfies readonly MatchKind[];

/** Below this mean brightness, a chart is too dark to read. */
const CHART_DARK = 0.03;
/** Below this share of the frame, the chart's corners are too close to read patches. */
const CHART_SMALL = 0.001;

const point = z
  .object({ u: z.number().min(0).max(1), v: z.number().min(0).max(1) })
  .describe("A point of the composition's frame: u 0 left to 1 right, v 0 top to 1 bottom.");

/**
 * Balances clips, matches them to another clip, or calibrates them from a color chart, reading
 * each clip's own ungraded picture (`TintApi.clipFrame`) through its grade with the CPU reference.
 * Every clip is captured first, then checked, then written in one undo step.
 */
export const match = defineCommand({
  id: "tint.match",
  label: "Match",
  description:
    "Balances or matches the own grade of clips (clipIds; clip level only, not shot group or timeline grades), reading each clip's ungraded picture at `at` microseconds (default: your playhead; a clip that doesn't hold that time is read at its middle) through its grade. kind auto: the darkest half percent of each channel goes to black (offset) and the mean of the picture comes out neutral (temperature and tint). kind white: the color at `point` comes out neutral, by temperature and tint first, then offset's color for what their ranges can't reach. kind gray: the same at `point`, offset's color first, then temperature and tint. auto, white and gray write temperature, tint and offset of one correction: nodeId (one clip only), else the first correction of the stack (the one the Tint tools edit with nothing selected), else a new one; that correction's other values stay and count. kind shot: makes each clip look like clip `from` (read at its middle): per channel the mean and spread of a log-ish encoding are matched, fitted as gain and offset, plus a saturation ratio, in a new correction \"Match nn\" at the bottom of the stack. kind chart: `corners` are a filmed 24-patch color chart's corners in the frame (top left at dark skin, top right, bottom right at black, bottom left at white); each patch's centre is read and a least-squares 3 x 3 matrix and offsets bring the patches to the published values (BabelColor sRGB averages), in a new correction \"Chart\" at the top of the stack (the matrix in the RGB mixer, keep brightness off; the offsets in the same correction's offset wheel). Every value is kept in its range. Returns { nodeIds } by clip id. One undo step for all clips, or nothing: fails with tint.match_input (a missing point, from or corners, or nodeId with several clips), tint.target_not_found, tint.not_gradeable, tint.match_self (from is one of clipIds), tint.no_picture (point or chart off the clip's picture, or nothing of the clip in the frame), tint.chart_too_dark, tint.chart_degenerate (corners too close, or patches too alike to solve), tint.node_not_found, tint.animated (temperature, tint or offset has keys), tint.sealed, tint.invalid_grade or preview.capture_failed.",
  undoable: true,
  input: z.object({
    clipIds: z.array(z.string().min(1)).min(1),
    kind: z.enum(KINDS),
    at: z.number().int().min(0).optional().describe("Microseconds"),
    point: point.optional().describe("For white and gray: where the white or gray thing is."),
    from: z.string().min(1).optional().describe("For shot: the clip to look like."),
    corners: z
      .tuple([point, point, point, point])
      .optional()
      .describe("For chart: top left, top right, bottom right, bottom left."),
    nodeId: z.string().min(1).optional().describe("For auto, white and gray: the correction."),
  }),
  async run(ctx, { clipIds, kind, at, point: spot, from, corners, nodeId }) {
    const ids = [...new Set(clipIds)];
    if ((kind === "white" || kind === "gray") && !spot) throw fail("match_input", "Give point.");
    if (kind === "shot" && !from) throw fail("match_input", "Give from: the clip to match to.");
    if (kind === "chart" && !corners) throw fail("match_input", "Give the chart's corners.");
    if (nodeId !== undefined && ids.length > 1) {
      throw fail("match_input", "nodeId names a correction of one clip: give one clip.");
    }
    const project = ctx.require(projectRef);
    const tint = ctx.require(tintRef);
    const before = project.store.getState();
    for (const clipId of ids) {
      readGrade(before, { clipId });
      if (clipId === from) throw fail("match_self", `Clip "${clipId}" can't match itself.`);
    }
    if (from) readGrade(before, { clipId: from });
    const playhead = at ?? ctx.require(previewRef).clockFor(ctx.actor).getTime();
    const capture = async (clipId: string, time: number): Promise<MatchRead> => {
      try {
        return { clipId, time, frame: await tint.clipFrame(clipId, time) };
      } catch (error) {
        throw new CommandFailure(
          "preview.capture_failed",
          String((error as Error).message ?? error),
        );
      }
    };
    const reads: MatchRead[] = [];
    for (const clipId of ids)
      reads.push(await capture(clipId, timeIn(before.clips[clipId]!, playhead)));
    const fromClip = from ? before.clips[from]! : null;
    // The other clip is read at its middle (`timeIn` of a time it never holds).
    const reference = fromClip ? await capture(fromClip.id, timeIn(fromClip, -1)) : null;

    const state = project.store.getState();
    if (from) readGrade(state, { clipId: from });
    const refColors = reference
      ? through(reference, shownAt(state, reference) ?? emptyGrade()).map((s) => s.rgb)
      : [];
    const writes: [string, ClipGrade | undefined][] = [];
    const nodeIds: Record<string, GradeNodeId> = {};
    for (const read of reads) {
      const target = { clipId: read.clipId };
      const stored = readGrade(state, target);
      const shown = shownAt(state, read);
      const { frame, placement } = read.frame;
      let id: GradeNodeId;
      let next: ClipGrade;
      let values: Partial<CorrectionValues> | null;
      if (kind === "auto" || kind === "white" || kind === "gray") {
        const named = nodeId ?? currentCorrection(stored);
        let view = shown ?? emptyGrade();
        if (named !== null) {
          refuseUnlessEditable(state, target, stored, named, ["temperature", "tint", "offset"]);
          id = named;
          next = structuredClone(stored!);
        } else {
          id = createId("node");
          next = withNew(stored, {}, id);
          view = withNew(shown, {}, id);
        }
        const one = kind === "auto" ? null : sourceAt(frame, spot!, placement);
        if (kind !== "auto" && !one)
          throw fail("no_picture", "That point is off the clip's picture.");
        const inputs = through(read, view, one ? [one] : undefined, id);
        values = balanceValues(correctionOf(view.nodes[id] as Correction), inputs, kind);
      } else if (kind === "shot") {
        id = createId("node");
        next = withNew(stored, {}, id, nextMatchName(stored));
        const colors = through(read, shown ?? emptyGrade()).map((s) => s.rgb);
        values = shotValues(colors, refColors);
      } else {
        if (quadArea(corners!, frame.width / frame.height) < CHART_SMALL) {
          throw fail("chart_degenerate", "The chart's corners are too close together.");
        }
        id = createId("node");
        const first = toStack(stored)[0];
        const place = first ? { before: first.id } : {};
        next = withNew(stored, place, id, "Chart");
        const view = withNew(shown, place, id, "Chart");
        const measured = CHART_REFERENCE.map((_, i) =>
          patchMean(read, view, id, patchPoints(corners!, i)),
        );
        if (measured.reduce((a, c) => a + luma(c), 0) / measured.length < CHART_DARK) {
          throw fail(
            "chart_too_dark",
            "The chart is too dark to read: light it, or place the corners on it.",
          );
        }
        values = chartValues(measured);
        if (!values) {
          throw fail(
            "chart_degenerate",
            "The patches are too alike to solve: check the corners sit on the chart.",
          );
        }
      }
      if (!values) throw fail("no_picture", `Nothing of clip "${read.clipId}" is in the frame.`);
      const node = next.nodes[id] as Correction;
      node.values = { ...node.values, ...values };
      writes.push([read.clipId, checkedGrade(next)]);
      nodeIds[read.clipId] = id;
    }
    ctx.mutate(project.store, (draft) => {
      for (const [clipId, grade] of writes) writeGrade(draft, { clipId }, grade);
    });
    return { nodeIds };
  },
});
