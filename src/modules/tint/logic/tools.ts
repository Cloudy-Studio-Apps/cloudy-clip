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
export function clearTools(
  node: Correction,
  tools: readonly ToolId[],
  fields: readonly string[] = [],
): void {
  if (node.values) for (const key of fields) delete (node.values as Record<string, unknown>)[key];
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

/** What the header's reset clears on the selected correction, for the tools that are built: what the page shows. */
export const PAGE_RESET: Partial<Record<ToolId, { tools: ToolId[]; fields?: string[] }>> = {
  basics: { tools: ["basics"] },
  // The wheels' page also shows six of the basics' numbers beside the wheels. Its tool owns every
  // mode's wheels (primary, log, zones), so the reset clears them all, whichever mode shows.
  wheels: {
    tools: ["wheels"],
    fields: ["temperature", "tint", "contrast", "pivot", "saturation", "hue"],
  },
  curves: { tools: ["curves"] },
  cmix: { tools: ["cmix"] },
  warper: { tools: ["warper"] },
  creative: { tools: ["creative"] },
  limit: { tools: ["limit"] },
  // Match writes into other tools' fields; its page shows only skin pull and protect skin.
  match: { tools: ["match"], fields: ["skinPull", "protectSkin"] },
  mixer: { tools: ["mixer"] },
};

/** Every tool id, for a command's input. */
export const TOOL_IDS = [
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
