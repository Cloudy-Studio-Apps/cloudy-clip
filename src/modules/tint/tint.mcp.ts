import { z } from "zod";
import { commandTool, defineMcpTool, errorResult, textResult, toAppError } from "@/core";
import { previewRef } from "@/modules/preview";
import {
  DEFAULT_CORRECTION,
  GRADE_RANGES,
  INPUT_SPACES,
  LIMIT_RANGES,
  projectRef,
} from "@/modules/project";
import { KEYABLE_VALUES } from "./logic/keyable";
import { numberOf, toStack } from "./logic/stack";
import { scopeStats } from "./logic/scopes";
import { TOOL_FIELDS } from "./logic/tools";
import { readGrade } from "./tint.guards";
import { tintRef } from "./tint.ref";
import { GUIDE_TOPICS, TINT_GUIDE } from "./tint.guide";
import { pixelsOf } from "./tint.pixels";
import { applyLook, importLut, relinkLut, setInput } from "./tint.color.commands";
import { copyGrade, pasteGrade } from "./tint.clipboard.commands";
import { grabStill, removeStill } from "./tint.still.commands";
import { match } from "./tint.match.commands";
import { setShotGroup, setVersion } from "./tint.shot.commands";
import { resetGrade } from "./tint.commands";
import { group, setGroup, ungroup } from "./tint.group.commands";
import { placeNodes, wire } from "./tint.wire.commands";
import {
  addCorrection,
  moveLayer,
  removeNodes,
  setCorrection,
  setCorrections,
} from "./tint.node.commands";
import { targetSchema } from "./tint.node.guards";

/** The data `tint_describe` can return, each by name. */
const DESCRIBE_SECTIONS = [
  "fields",
  "ranges",
  "limitRanges",
  "tools",
  "keyable",
  "spaces",
  "looks",
  "stills",
  "luts",
] as const;

/** Reads a grade as layers with their numbers and names, and every node with its full values. */
const getGrade = defineMcpTool({
  name: "tint_get_grade",
  readOnly: true,
  description:
    "Returns a grade: layers (the stack top to bottom, closest to the source first; each a layer, a group of branches, or a sealed card of nodes the stack can't show) with each correction's number (\"01\"…) and name, and nodes by id with the correction's values: only what differs from the defaults (tint_describe lists them), limit, opacity and on. Takes the same target as tint_add_correction. An ungraded target returns no layers. Fails with tint.target_not_found or tint.not_gradeable.",
  input: z.object({ target: targetSchema }),
  handler({ target }, ctx) {
    const grade = readGrade(ctx.require(projectRef).store.getState(), target);
    const numbers = numberOf(grade);
    const nodes = Object.fromEntries(
      Object.entries(grade?.nodes ?? {}).map(([id, node]) => [
        id,
        node.kind === "correct" ? { ...node, number: numbers[id] } : node,
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

/** What a grade can hold: fields, ranges, tools, color spaces, looks and LUTs, and the guide. */
const describe = defineMcpTool({
  name: "tint_describe",
  readOnly: true,
  description:
    "Lists what a grade can hold. `sections` picks the data returned (default: all of it, unless only `guide` is given): fields (every value field of a correction with its default), ranges (min and max of each number by dotted path), limitRanges (the numbers of a limit), tools (each tool and the fields it owns: what tint_reset with tools clears; nodeId limits it to one correction, and fields names top-level value fields to clear alone or beside the tools), keyable (the numbers that can hold keys on a clip's own grade, by dotted path under values: key one with keyframe_set at path grade.nodes.<nodeId>.values.<path>, or grade.nodes.<nodeId>.opacity; Color mix, the warper, the mixer, curves and the shot group and timeline grades are never keyed; a keyed number can't be set statically, pass at to tint_set_correction to key it), spaces (the camera color spaces a grade's input can be), looks (id, name, note, corrections; apply one with tint_apply_look lookId), stills (grabbed frames with their grades: id, name, hasGrade, from; apply with tint_apply_look stillId) and luts (imported ones: id, name, path, size, status ready, loading or missing; a missing one is left out of the preview and fails an export, fix it with tint_relink_lut; built-in looks have ids starting with builtin:). `guide` adds how grading works as text, by topic: values (wheels, the order inside a correction, LUTs, log and zone wheels, rolloff, skinPull, the mixer, creative), curves (custom and hue curves, Color mix, the warper), limit (keeping a correction to part of the picture), groups (side by side, stacked, per channel, Leader Seal wiring, key joins), input (camera color spaces), levels (clip, shot group and timeline grades, and versions), match (tint_match) and copy (tint_copy, tint_paste). Read the topics you need before grading.",
  input: z.object({
    sections: z
      .array(z.enum(DESCRIBE_SECTIONS))
      .optional()
      .describe("Data to return. Default: all"),
    guide: z
      .array(z.enum(GUIDE_TOPICS))
      .optional()
      .describe('Topics of the guide to return as text, e.g. ["values", "limit"]'),
  }),
  handler(input, ctx) {
    const state = ctx.require(projectRef).store.getState();
    const files = ctx.require(tintRef).luts.store;
    const data: Record<(typeof DESCRIBE_SECTIONS)[number], () => unknown> = {
      fields: () => DEFAULT_CORRECTION,
      ranges: () => GRADE_RANGES,
      limitRanges: () => LIMIT_RANGES,
      tools: () => TOOL_FIELDS,
      keyable: () => KEYABLE_VALUES,
      spaces: () => INPUT_SPACES,
      looks: () => ctx.require(tintRef).looks.list(),
      stills: () =>
        (state.stillOrder ?? []).flatMap((id) => {
          const still = state.stills?.[id];
          return still
            ? [{ id, name: still.name, hasGrade: still.grade !== undefined, from: still.from }]
            : [];
        }),
      luts: () =>
        Object.values(state.luts ?? {}).map(({ id, name, path, size }) => {
          const file = files.getState()[path];
          return { id, name, path, size, status: file?.status ?? "loading" };
        }),
    };
    const sections = input.sections ?? (input.guide ? [] : DESCRIBE_SECTIONS);
    return textResult({
      ...Object.fromEntries(sections.map((name) => [name, data[name]()])),
      ...(input.guide && {
        guide: Object.fromEntries(input.guide.map((topic) => [topic, TINT_GUIDE[topic]])),
      }),
    });
  },
});

/** Measures a frame of the composition as numbers, so an agent can judge a grade without eyes. */
const scopes = defineMcpTool({
  name: "tint_scopes",
  readOnly: true,
  description:
    "Measures the graded frame of your open composition (or compositionId) at `at` microseconds (default: your playhead, in your open composition; with a compositionId other than the open one, pass `at`): r, g, b each { min, max, mean } as 8-bit values 0 to 255; clipped.low and clipped.high, the shares 0 to 1 of pixels with luma at or under 1% and at or over 99%; histogram, 16 luma buckets from black to white, each a share of the pixels (they sum to 1); skinDistance, the mean angle in degrees (0 to 180, 0 on the line) between each pixel's vectorscope hue and the 123 degree skin line, weighted by saturation (null when the picture has almost no color). Returns the time measured as `time`. Neither the user's preview nor your playhead moves. Fails with preview.capture_failed.",
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
  /** Adds a `.cube` LUT file by path; a correction uses it through tint_set_correction's patch.lut. */
  commandTool(importLut, { name: "tint_import_lut" }),
  /** Points an imported LUT at the file's new path, as media_relink does for media. */
  commandTool(relinkLut, { name: "tint_relink_lut" }),
  /** Turns several corrections on or off, or fades them, in one undo step. */
  commandTool(setCorrections, { name: "tint_set_corrections" }),
  commandTool(removeNodes, { name: "tint_remove_nodes" }),
  commandTool(moveLayer, { name: "tint_move_layer" }),
  commandTool(resetGrade, { name: "tint_reset" }),
  commandTool(group, { name: "tint_group" }),
  commandTool(ungroup, { name: "tint_ungroup" }),
  commandTool(setGroup, { name: "tint_set_group" }),
  /** Leader Seal's free wiring: rewires nodes and adds joins, splits and key joins. */
  commandTool(wire, { name: "tint_wire" }),
  /** Where nodes sit in Leader Seal; an agent can lay out the graph as a user can. */
  commandTool(placeNodes, { name: "tint_place_nodes" }),
  /** The camera color space of clips, turned into Rec.709 before the grade. */
  commandTool(setInput, { name: "tint_set_input" }),
  /** Adds a built-in or plugin look, or a still's grade, after everything on clips. */
  commandTool(applyLook, { name: "tint_apply_look" }),
  /** Copies a grade to your own clipboard. */
  commandTool(copyGrade, { name: "tint_copy" }),
  /** Pastes your clipboard onto clips: the whole grade, or only some tools of it. */
  commandTool(pasteGrade, { name: "tint_paste" }),
  /** Saves the grade of the clip at a time, with its picture, as a still. */
  commandTool(grabStill, { name: "tint_grab_still" }),
  /** Deletes a still. */
  commandTool(removeStill, { name: "tint_remove_still" }),
  /** Makes, joins or leaves a shot group: clips that share a grade after their own. */
  commandTool(setShotGroup, { name: "tint_set_shot_group" }),
  commandTool(setVersion, { name: "tint_set_version" }),
  /** Balances clips (auto, or at a white or gray point), matches them to another clip, or calibrates them from a color chart. */
  commandTool(match, { name: "tint_match" }),
];
