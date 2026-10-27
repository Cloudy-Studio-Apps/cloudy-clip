import { commandTool } from "@/core";
import { addText } from "./text.commands";

/** Text tools for agents, with the same rules as the Text tab. */
export const textMcpTools = [commandTool(addText, { name: "text_add" })];
