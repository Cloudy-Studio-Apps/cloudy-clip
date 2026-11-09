import { z } from "zod";
import { commandTool, defineMcpTool, errorResult, textResult, toAppError } from "@/core";
import { previewRef } from "@/modules/preview";
import {
  DEFAULT_CORRECTION,
  GRADE_RANGES,
  LIMIT_RANGES,
  correctionOf,
  projectRef,
} from "@/modules/project";
import { numberOf, toStack } from "./logic/stack";
import { scopeStats } from "./logic/scopes";
import { TOOL_FIELDS } from "./logic/tools";
import { readGrade } from "./tint.guards";
import { pixelsOf } from "./tint.pixels";
import { resetGrade } from "./tint.commands";
import { group, setGroup, ungroup } from "./tint.group.commands";
import {
  addCorrection,
  moveLayer,
  removeNodes,
  setCorrection,
  targetSchema,
} from "./tint.node.commands";

const INPUT_SPACES = ["rec709", "srgb", "slog3", "appleLog", "clog2", "clog3", "vlog", "flog"];

/** Reads a grade as layers with their numbers and names, and every node with its full values. */
const getGrade = defineMcpTool({
  name: "tint_get_grade",
  readOnly: true,
  description:
    "Returns a grade: layers (the stack top to bottom, closest to the source first; each a layer, a group of branches, or a sealed card of nodes the stack can't show) with each correction's number (\"01\"…) and name, and nodes by id with the correction's values in full (its own over the defaults), limit, opacity and on. Takes the same target as tint_add_correction. An ungraded target returns no layers. Fails with tint.target_not_found or tint.not_gradeable.",
  input: z.object({ target: targetSchema }),
  handler({ target }, ctx) {
    const grade = readGrade(ctx.require(projectRef).store.getState(), target);
    const numbers = numberOf(grade);
    const nodes = Object.fromEntries(
      Object.entries(grade?.nodes ?? {}).map(([id, node]) => [
        id,
        node.kind === "correct"
          ? { ...node, number: numbers[id], values: correctionOf(node) }
          : node,
      ]),
    );
    return textResult({
      layers: toStack(grade),
      numbers,
      nodes,
      out: grade?.out ?? { node: "source" },
      input: grade?.input ?? "rec709",
    });
  },
});

/** What a grade can hold: fields, ranges, tools, color spaces, looks and LUTs. */
const describe = defineMcpTool({
  name: "tint_describe",
  readOnly: true,
  description:
    "Lists what a correction holds: every value field with its default, the range of each number by dotted path (min and max), the tools and the fields each owns (what tint_reset with tools clears; nodeId limits it to one correction, and fields names top-level value fields to clear alone or beside the tools), the camera color spaces a grade's input can be, the looks (none yet) and the LUTs (imported ones by id; built-in looks have ids starting with builtin:). Wheels are { x, y, m } in -1 to 1; curves are point lists [x, y] in 0 to 1, at least 2, x increasing from 0 to 1. The custom curves (curves.rgb.y, then r, g, b per channel) map brightness in to out (neutral [[0,0],[1,1]]). hueHue, hueSat and hueLum read the hue as x (0 red, about 0.2 yellow, 0.35 green, 0.5 cyan, 0.7 blue, 0.85 magenta; the point at x 1 is the one at x 0 again) and lumSat reads brightness; each is neutral at y 0.5: hueHue turns the hue by (y - 0.5) of a full turn, hueSat and lumSat scale saturation by 2y, hueLum scales brightness of saturated colors by 2y. Color mix (mix) has eight families, each { hue, sat, lum } in -100 to 100, at the hue-curve hues reds 0, oranges 0.099, yellows 0.2, greens 0.352, aquas 0.5, blues 0.654, purples 0.783, magentas 0.883: hue ±100 turns that family by ±30 degrees, sat ±100 scales its saturation from 0 to 2, lum ±100 scales the brightness of its saturated colors from 0.5 to 1.5; range 0 to 100 is how far a family reaches (0: half way to its neighbours, 100: to their centers). Color mix is applied with the hue curves, on the same input. The warper (warper) moves colors on a disc of hue and strength after the curves: points are keyed by grid index 0 to 35, index = ring * 12 + spoke, spoke k at hue k/12 (same hue as the curves, red 0), ring 0, 1, 2 at strength 1/3, 2/3, 1 (strength 1 = chroma 0.5; the center never moves); each point { dh, ds } moves that grid point by dh degrees of hue (-180 to 180) and ds of strength (-1 to 1). Points not stored follow the stored ones by smoothing (0 to 100: 0 none, 100 widest), except pinned indices, which never follow. Colors between grid points move by the blend of their neighbours. Color mix and the hue curves share one capped row each: Hue vs Hue (hueHue plus every family's hue) totals at most ±180 degrees, Hue vs Saturation (hueSat times every family's sat) at most ×2, Hue vs Brightness at most ×0 to ×2; past that they clip. Order inside a correction: exposure and white balance, the primary wheels, the log and zone wheels, contrast and pivot, highlights/shadows/whites/blacks, rolloff, curves with Color mix, the warper, saturation/vibrance/hue (protectSkin keeps skin hues out of them), skinPull, the mixer, creative. The log wheels (log.shadow, midtone, highlight) each add like offset over a band of brightness: shadow fades out by lowRange, highlight starts at highRange, midtone in between. Zone wheels z0 to z5 each add over a narrow band (±0.18 of brightness) around their `at` (0 to 1). rolloff 0 to 100 eases values above 1 - rolloff/200 toward 1. skinPull 0 to 100 turns hues near the 123 degree skin line toward it (up to 75% of the way). mixer.matrix: rows are output r, g, b, columns input r, g, b (-2 to 2); keepBrightness keeps the brightness of grays (the matrix is scaled by 1 / the brightness of its row sums, only when that is at least 0.05; below it, or negative, the matrix is used unscaled, so it never blows out or inverts the picture); mono puts the brightness of the mixed color in all three. creative.shadowTint and highlightTint are wheel pucks { x, y } in -1 to 1 (red at the top, clockwise, y down) tinting the darks and the brights; balance -100 to 100 (+ gives the highlight tint more); fade 0 to 100 lifts the blacks and mutes colors; vignette { amount -100 (darker edges) to 100 (lighter), midpoint 0 to 100 (how far out it starts), roundness -100 (rectangle) to 100 (circle; 0 fits the picture), feather 0 to 100 (softness) }, drawn over the clip's own picture. A limit (patch.limit of tint_set_correction; ranges by path under limitRanges) keeps a correction to some of the picture: the corrected picture is mixed over the correction's input by key times opacity, the key read from that input. color { on, hue [a, b] in degrees 0 to 360 on the hue curves' circle (red 0, yellow about 72, green 127, cyan 180, blue 252, magenta 307; a > b wraps through red, [0, 360] is every hue), sat [a, b] 0 to 1 of full chroma, lum [a, b] 0 to 1 of brightness, soft 0 to 100 (edges fall off outward over up to 30 degrees and 0.25) } keeps the colors inside all three (a gray passes the hue window). brightness { on, range [a, b] 0 to 1, soft 0 to 100 (edges up to 0.25) } keeps a band of brightness (darks [0, 0.3], mids [0.3, 0.7], brights [0.7, 1]). Both on: what both keep. refine { soft 0 to 100 (blurs the key by up to 3% of the picture's height), clean 0 to 100 (pulls the key toward 0 and 1, so specks go) }; invert: true changes everything but what is kept. A limit with neither color nor brightness on limits nothing. limit.from (a correction id above this one, whose limit limits something) uses that correction's pick instead: its key with its refine and clean up; invert: true here inverts it again. Groups (tint_group, tint_ungroup, tint_set_group; in tint_get_grade a layer item of type group with its branches, and its join node): Side by side (a parallel join: out = in + opacity · Σ (branch − in), in being the picture above the group), Stacked (a layer join: from the picture above, each branch in order lands over the picture so far by its blend mode, the last on top; normal is the branch itself, other modes blend the two clamped to 0 to 1; then mixed over the picture above by opacity), Per channel (a split and a join: the red, green and blue branches each grade one channel of the picture above as gray, and the join takes red from the red branch, green from the green one and blue from the blue one). A group that is off, or at opacity 0, passes the picture above unchanged.",
  input: z.object({}),
  handler(_input, ctx) {
    const state = ctx.require(projectRef).store.getState();
    return textResult({
      fields: DEFAULT_CORRECTION,
      ranges: GRADE_RANGES,
      limitRanges: LIMIT_RANGES,
      tools: TOOL_FIELDS,
      spaces: INPUT_SPACES,
      looks: [],
      luts: Object.values(state.luts ?? {}).map(({ id, name, size }) => ({ id, name, size })),
    });
  },
});

/** Measures a frame of the composition as numbers, so an agent can judge a grade without eyes. */
const scopes = defineMcpTool({
  name: "tint_scopes",
  readOnly: true,
  description:
    "Measures the graded frame of your open composition (or compositionId) at `at` microseconds (default: your playhead, in your open composition; with a compositionId other than the open one, pass `at`): r, g, b each { min, max, mean } as 8-bit values 0 to 255; clipped.low and clipped.high, the shares 0 to 1 of pixels with luma at or under 1% and at or over 99%; histogram, 16 luma buckets from black to white, each a share of the pixels (they sum to 1); skinDistance, the mean angle in degrees (0 to 180, 0 on the line) between each pixel's vectorscope hue and the 123 degree skin line, weighted by saturation. Returns the time measured as `time`. Neither the user's preview nor your playhead moves. Fails with preview.capture_failed.",
  input: z.object({
    at: z.number().int().min(0).optional().describe("Microseconds"),
    compositionId: z.string().optional(),
  }),
  async handler({ at, compositionId }, ctx) {
    const preview = ctx.require(previewRef);
    try {
      const id = compositionId ?? ctx.require(projectRef).view.requireOpen(ctx.caller.key).id;
      const clock = preview.clockFor(ctx.caller.key);
      const time = at ?? clock.getTime();
      const frame = await pixelsOf(await preview.captureAt(time, id));
      return textResult({ time, ...scopeStats(frame) });
    } catch (error) {
      return errorResult({ ...toAppError(error), code: "preview.capture_failed" });
    }
  },
});

/** Agents grade with the same commands as the user. */
export const tintMcpTools = [
  getGrade,
  describe,
  scopes,
  commandTool(addCorrection, { name: "tint_add_correction" }),
  commandTool(setCorrection, { name: "tint_set_correction" }),
  commandTool(removeNodes, { name: "tint_remove_nodes" }),
  commandTool(moveLayer, { name: "tint_move_layer" }),
  commandTool(resetGrade, { name: "tint_reset" }),
  commandTool(group, { name: "tint_group" }),
  commandTool(ungroup, { name: "tint_ungroup" }),
  commandTool(setGroup, { name: "tint_set_group" }),
];
