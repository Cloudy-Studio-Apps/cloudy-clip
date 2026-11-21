import { z } from "zod";
import { CommandFailure, commandTool, defineMcpTool, errorResult, textResult } from "@/core";
import { projectRef } from "@/modules/project";
import { toSrt } from "./logic/srt";
import { addCue, mergeCues, splitCue } from "./subtitle.cue.commands";
import { importSubtitles } from "./subtitle.import.command";
import { mark, resetToStyle, unmark } from "./subtitle.mark.commands";
import {
  addStyle,
  removeStyle,
  renameStyle,
  reorderStyles,
  updateStyle,
} from "./subtitle.style.commands";

/** The cues of a composition as `.srt` text, to read or hand over. */
const toSrtTool = defineMcpTool({
  name: "subtitle_to_srt",
  description:
    "Returns the .srt text of the marked, enabled subtitle cues on the tracks of your open composition or compositionId, by start time, with times to the millisecond and the words as stored.",
  readOnly: true,
  input: z.object({ compositionId: z.string().optional() }),
  handler({ compositionId }, ctx) {
    try {
      const { store, view } = ctx.require(projectRef);
      const id = compositionId ?? view.requireOpen(ctx.caller.key).id;
      if (!store.getState().compositions[id]) {
        throw new CommandFailure("subtitle.composition_not_found", `No composition "${id}".`);
      }
      return textResult(toSrt(store.getState(), id));
    } catch (error) {
      if (error instanceof CommandFailure) {
        return errorResult({ code: error.code, message: error.message });
      }
      throw error;
    }
  },
});

/** Agents make subtitle styles and cues, mark them, import and read `.srt` with the same commands as the user. */
export const subtitleMcpTools = [
  commandTool(addStyle, { name: "subtitle_add_style" }),
  commandTool(updateStyle, { name: "subtitle_update_style" }),
  commandTool(renameStyle, { name: "subtitle_rename_style" }),
  commandTool(removeStyle, { name: "subtitle_remove_style" }),
  commandTool(reorderStyles, { name: "subtitle_reorder_styles" }),
  commandTool(mark, { name: "subtitle_mark" }),
  commandTool(unmark, { name: "subtitle_unmark" }),
  commandTool(resetToStyle, { name: "subtitle_reset_to_style" }),
  commandTool(addCue, { name: "subtitle_add_cue" }),
  commandTool(splitCue, { name: "subtitle_split_cue" }),
  commandTool(mergeCues, { name: "subtitle_merge_cues" }),
  commandTool(importSubtitles, { name: "subtitle_import" }),
  toSrtTool,
];
