import { commandTool } from "@/core";
import { setClipTransform } from "./transform.commands";

/** Agents place pictures in the frame with the same command as the canvas tools. */
export const transformMcpTools = [
  commandTool(setClipTransform, { name: "transform_set_clip_transform" }),
];
