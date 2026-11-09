import type { Correction, CorrectionValues } from "@/modules/project";
import type { ToolId } from "../tint.types";

/** What a tool owns on a correction: value fields, and the `limit` or `lut` of the node itself. */
export interface ToolFields {
  values: (keyof CorrectionValues)[];
  limit?: true;
  lut?: true;
}

/** The fields of a correction each tool owns, also those not built yet. `match` owns none: it writes into the others. */
export const TOOL_FIELDS: Record<ToolId, ToolFields> = {
  basics: {
    values: [
      "exposure",
      "contrast",
      "pivot",
      "highlights",
      "shadows",
      "whites",
      "blacks",
      "temperature",
      "tint",
      "vibrance",
      "saturation",
      "hue",
      "rolloff",
      "protectSkin",
      "skinPull",
    ],
  },
  wheels: { values: ["lift", "gamma", "gain", "offset", "log", "zones"] },
  curves: { values: ["curves"] },
  cmix: { values: ["mix"] },
  warper: { values: ["warper"] },
  creative: { values: ["creative"] },
  limit: { values: [], limit: true },
  luts: { values: [], lut: true },
  match: { values: [] },
  mixer: { values: ["mixer"] },
};

/** The correction without what these tools own (its values, limit or LUT). */
export function clearTools(node: Correction, tools: readonly ToolId[]): void {
  for (const tool of tools) {
    const owned = TOOL_FIELDS[tool];
    if (node.values) for (const key of owned.values) delete node.values[key];
    if (owned.limit) delete node.limit;
    if (owned.lut) delete node.lut;
  }
  if (node.values && Object.keys(node.values).length === 0) delete node.values;
}

/** The value fields (top level) the tools own. */
export function ownedValues(tools: readonly ToolId[]): Set<string> {
  return new Set(tools.flatMap((tool) => TOOL_FIELDS[tool].values));
}
