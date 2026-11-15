import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { DEFAULT_CORRECTION, projectRef, type Correction } from "@/modules/project";
import { groupOf } from "./logic/stack.group";
import { clearTools, ownedValues } from "./logic/tools";
import { group, setGroup, ungroup } from "./tint.group.commands";
import { placeNodes, wire } from "./tint.wire.commands";
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
    'Resets a grade. With no tools, nodeId or fields, the whole grade goes and the target is ungraded (its key tracks go too). With tools (basics, wheels, curves, cmix, warper, creative, limit, luts, match, mixer), only the fields those tools own are cleared (the limit for "limit", the LUT for "luts"), along with their key tracks; the layers stay. With nodeId, only that correction is touched, or with the id of a group every correction inside it, not the opacity, on or blends of the group itself (all tools when none are given); with fields (top-level value names such as "saturation"), those fields are cleared on top of the tools, and given alone they clear only those. Resetting an ungraded target does nothing. Fails with tint.target_not_found, tint.not_gradeable, tint.node_not_found or tint.invalid_grade (a field that is not a correction field).',
  undoable: true,
  input: z.object({
    target: targetSchema,
    tools: z.array(z.enum(TOOL_IDS)).min(1).optional(),
    nodeId: z.string().min(1).optional(),
    fields: z.array(z.string().min(1)).min(1).optional(),
  }),
  run(ctx, { target, tools: given, nodeId, fields }) {
    const { store } = ctx.require(projectRef);
    for (const name of fields ?? []) {
      if (!Object.hasOwn(DEFAULT_CORRECTION, name)) {
        throw new CommandFailure("tint.invalid_grade", `"${name}" is not a field of a correction`, {
          field: name,
        });
      }
    }
    const grade = readGrade(store.getState(), target);
    if (!grade) return;
    // A group's id stands for every correction inside it.
    const only = nodeId
      ? grade.nodes[nodeId]?.kind === "correct"
        ? [nodeId]
        : groupOf(grade, nodeId)?.corrections
      : undefined;
    if (nodeId && !only) {
      throw new CommandFailure(
        "tint.node_not_found",
        `No correction or group "${nodeId}" in this grade`,
        {
          nodeId,
        },
      );
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
      if (node.kind !== "correct" || (only && !only.includes(id))) continue;
      clearTools(node as Correction, tools, fields);
    }
    const stored = checkedGrade(next);
    if (JSON.stringify(stored) === JSON.stringify(grade)) return;
    const owned = ownedValues(tools);
    for (const field of fields ?? []) owned.add(field);
    const keyed = (path: string): boolean => {
      const [, , id, part, ...rest] = path.split(".");
      if (only && !only.includes(id ?? "")) return false;
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

export const tintCommands = [
  addCorrection,
  setCorrection,
  removeNodes,
  moveLayer,
  resetGrade,
  group,
  ungroup,
  setGroup,
  wire,
  placeNodes,
];
