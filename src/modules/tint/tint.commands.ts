import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
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
    'Resets a grade. Without tools, the whole grade goes and the target is ungraded (its key tracks go too). With tools (basics, wheels, curves, cmix, warper, creative, limit, luts, match, mixer), only the fields those tools own are cleared on every correction (or on the one correction `nodeId`; `fields` names more top-level value fields to clear, such as "saturation") (the limit for "limit", the LUT for "luts"), along with their key tracks; the layers stay. Resetting an ungraded target does nothing. Fails with tint.target_not_found or tint.not_gradeable.',
  undoable: true,
  input: z.object({
    target: targetSchema,
    tools: z.array(z.enum(TOOL_IDS)).min(1).optional(),
    nodeId: z.string().min(1).optional(),
    fields: z.array(z.string().min(1)).min(1).optional(),
  }),
  run(ctx, { target, tools: given, nodeId, fields }) {
    const { store } = ctx.require(projectRef);
    const grade = readGrade(store.getState(), target);
    if (!grade) return;
    if (nodeId && grade.nodes[nodeId]?.kind !== "correct") {
      throw new CommandFailure("tint.node_not_found", `No correction "${nodeId}" in this grade`, {
        nodeId,
      });
    }
    const tools = given ?? (nodeId || fields ? (fields ? [] : [...TOOL_IDS]) : undefined);
    if (!tools) {
      ctx.mutate(store, (draft) => {
        writeGrade(draft, target, undefined);
        dropTracks(draft, target, () => true);
      });
      return;
    }
    const next = structuredClone(grade);
    for (const [id, node] of Object.entries(next.nodes)) {
      if (node.kind !== "correct" || (nodeId && id !== nodeId)) continue;
      clearTools(node as Correction, tools, fields);
    }
    const stored = checkedGrade(next);
    if (JSON.stringify(stored) === JSON.stringify(grade)) return;
    const owned = ownedValues(tools);
    for (const field of fields ?? []) owned.add(field);
    const keyed = (path: string): boolean => {
      const [, , id, part, ...rest] = path.split(".");
      if (nodeId && id !== nodeId) return false;
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
