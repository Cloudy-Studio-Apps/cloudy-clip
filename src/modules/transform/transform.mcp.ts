import { commandTool } from "@/core";
import { flipTransform, resetTransform } from "./transform.commands";

/**
 * Agents reset and flip pictures with the same commands as the inspector. They move, scale,
 * stretch, rotate and set the pivot with `element_set_props` (`{ transform: { … } }`), like the
 * canvas tools.
 */
export const transformMcpTools = [
  commandTool(resetTransform, { name: "transform_reset" }),
  commandTool(flipTransform, { name: "transform_flip" }),
];
