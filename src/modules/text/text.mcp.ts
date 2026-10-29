import { commandTool } from "@/core";
import { applyTextPreset } from "./text.commands";

/**
 * Text tools for agents, with the same rules as the Text tab. Texts are added with
 * `timeline_add_element` (kind "text"); words and style change with `element_set_props` (see
 * `element_describe`); pick font families with `fonts_list`.
 */
export const textMcpTools = [commandTool(applyTextPreset, { name: "text_apply_preset" })];
