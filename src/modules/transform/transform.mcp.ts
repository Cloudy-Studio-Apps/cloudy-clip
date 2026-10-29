import { commandTool } from "@/core";
import { resetTransform } from "./transform.commands";

/**
 * Agents reset pictures with the same command as the inspector. They move, scale and rotate them
 * with `element_set_props` (`{ transform: { … } }`), like the canvas tools.
 */
export const transformMcpTools = [commandTool(resetTransform, { name: "transform_reset" })];
