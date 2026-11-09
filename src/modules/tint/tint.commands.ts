import { z } from "zod";
import { defineCommand } from "@/core";
import { projectRef, type Correction } from "@/modules/project";
import { clearTools, ownedValues } from "./logic/tools";
import { checkedGrade, dropTracks, readGrade, writeGrade } from "./tint.guards";
import {
  addCorrection,
  moveLayer,
  removeNodes,
  setCorrection,
  targetSchema,
} from "./tint.node.commands";
import type { ToolId } from "./tint.types";

const TOOL_IDS = [
  "basics",
  "wheels",
  "curves",
  "cmix",
  "warper",
  "creative",
  "limit",
  "luts",
  "match",
  "mixer",
] as const satisfies readonly ToolId[];

/** Puts a grade back as the file is, or only what some tools own. */
export const resetGrade = defineCommand({
  id: "tint.reset",
  label: "Reset grade",
  description:
    'Resets a grade. Without tools, the whole grade goes and the target is ungraded (its key tracks go too). With tools (basics, wheels, curves, cmix, warper, creative, limit, luts, match, mixer), only the fields those tools own are cleared on every correction (the limit for "limit", the LUT for "luts"), along with their key tracks; the layers stay. Resetting an ungraded target does nothing. Fails with tint.target_not_found or tint.not_gradeable.',
  undoable: true,
  input: z.object({ target: targetSchema, tools: z.array(z.enum(TOOL_IDS)).min(1).optional() }),
  run(ctx, { target, tools }) {
    const { store } = ctx.require(projectRef);
    const grade = readGrade(store.getState(), target);
    if (!grade) return;
    if (!tools) {
      ctx.mutate(store, (draft) => {
        writeGrade(draft, target, undefined);
        dropTracks(draft, target, () => true);
      });
      return;
    }
    const next = structuredClone(grade);
    for (const node of Object.values(next.nodes)) {
      if (node.kind === "correct") clearTools(node as Correction, tools);
    }
    const stored = checkedGrade(next);
    const owned = ownedValues(tools);
    const keyed = (path: string): boolean => {
      const [, , , part, ...rest] = path.split(".");
      if (part === "limit") return tools.includes("limit");
      if (part === "lut") return tools.includes("luts");
      return part === "values" && owned.has((rest[0] ?? "").trim());
    };
    ctx.mutate(store, (draft) => {
      writeGrade(draft, target, stored);
      dropTracks(draft, target, (path) => !stored || keyed(path));
    });
  },
});

export const tintCommands = [addCorrection, setCorrection, removeNodes, moveLayer, resetGrade];
