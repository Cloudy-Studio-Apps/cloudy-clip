import { commandTool } from "@/core";
import { addText, applyTextPreset, setText, setTextStyle } from "./text.commands";

/** Text tools for agents, with the same rules as the Text tab. Pick font families with `fonts_list`. */
export const textMcpTools = [
  commandTool(addText, { name: "text_add" }),
  commandTool(setText, { name: "text_set_text" }),
  commandTool(setTextStyle, { name: "text_set_style" }),
  commandTool(applyTextPreset, { name: "text_apply_preset" }),
];
