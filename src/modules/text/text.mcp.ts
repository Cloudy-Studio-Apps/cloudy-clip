import { commandTool } from "@/core";
import { addText, applyTextPreset } from "./text.commands";

/**
 * Text tools for agents, with the same rules as the Text tab. Words and style change with
 * `element_set_props` (see `element_describe`); pick font families with `fonts_list`.
 */
export const textMcpTools = [
  commandTool(addText, { name: "text_add" }),
  commandTool(applyTextPreset, { name: "text_apply_preset" }),
];
