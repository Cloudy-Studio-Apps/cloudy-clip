import { z } from "zod";
import { commandTool, defineMcpTool, errorResult, textResult, toAppError } from "@/core";
import { previewRef } from "@/modules/preview";
import { DEFAULT_CORRECTION, GRADE_RANGES, correctionOf, projectRef } from "@/modules/project";
import { numberOf, toStack } from "./logic/stack";
import { scopeStats } from "./logic/scopes";
import { TOOL_FIELDS } from "./logic/tools";
import { readGrade } from "./tint.guards";
import { resetGrade } from "./tint.commands";
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
    "Lists what a correction holds: every value field with its default, the range of each number by dotted path (min and max), the tools and the fields each owns (what tint_reset with tools clears), the camera color spaces a grade's input can be, the looks (none yet) and the LUTs (imported ones by id; built-in looks have ids starting with builtin:). Wheels are { x, y, m } in -1 to 1; curves are point lists [x, y] in 0 to 1.",
  input: z.object({}),
  handler(_input, ctx) {
    const state = ctx.require(projectRef).store.getState();
    return textResult({
      fields: DEFAULT_CORRECTION,
      ranges: GRADE_RANGES,
      tools: TOOL_FIELDS,
      spaces: INPUT_SPACES,
      looks: [],
      luts: Object.values(state.luts ?? {}).map(({ id, name, size }) => ({ id, name, size })),
    });
  },
});

/** Reads a PNG data URL as pixels. */
async function pixelsOf(data: string): Promise<ImageData> {
  const url = data.startsWith("data:") ? data : `data:image/png;base64,${data}`;
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2D canvas to read the frame with");
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Measures a frame of the composition as numbers, so an agent can judge a grade without eyes. */
const scopes = defineMcpTool({
  name: "tint_scopes",
  readOnly: true,
  description:
    "Measures the graded frame of your open composition (or compositionId) at `at` microseconds (default your playhead): r, g, b each { min, max, mean } as 8-bit values 0 to 255; clipped.low and clipped.high, the shares 0 to 1 of pixels with luma at or under 1% and at or over 99%; histogram, 16 luma buckets from black to white, each a share of the pixels (they sum to 1); skinDistance, the mean angle in degrees (0 to 180, 0 on the line) between each pixel's vectorscope hue and the 123 degree skin line, weighted by saturation. The user's preview doesn't move. Fails with preview.capture_failed.",
  input: z.object({
    at: z.number().int().min(0).optional().describe("Microseconds"),
    compositionId: z.string().optional(),
  }),
  async handler({ at, compositionId }, ctx) {
    const preview = ctx.require(previewRef);
    try {
      const id = compositionId ?? ctx.require(projectRef).view.requireOpen(ctx.caller.key).id;
      const clock = preview.clockFor(ctx.caller.key);
      if (at !== undefined) clock.seek(at);
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
];
