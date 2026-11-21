import { commandTool } from "@/core";
import { mark, resetToStyle, unmark } from "./subtitle.mark.commands";
import {
  addStyle,
  removeStyle,
  renameStyle,
  reorderStyles,
  updateStyle,
} from "./subtitle.style.commands";

/** Agents make subtitle styles and mark cues with the same commands as the user. */
export const subtitleMcpTools = [
  commandTool(addStyle, { name: "subtitle_add_style" }),
  commandTool(updateStyle, { name: "subtitle_update_style" }),
  commandTool(renameStyle, { name: "subtitle_rename_style" }),
  commandTool(removeStyle, { name: "subtitle_remove_style" }),
  commandTool(reorderStyles, { name: "subtitle_reorder_styles" }),
  commandTool(mark, { name: "subtitle_mark" }),
  commandTool(unmark, { name: "subtitle_unmark" }),
  commandTool(resetToStyle, { name: "subtitle_reset_to_style" }),
];
