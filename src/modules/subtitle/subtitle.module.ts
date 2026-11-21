import { defineModule } from "@/core";
import { addCue, mergeCues, splitCue } from "./subtitle.cue.commands";
import { importSubtitles } from "./subtitle.import.command";
import { mark, resetToStyle, unmark } from "./subtitle.mark.commands";
import { subtitleMcpTools } from "./subtitle.mcp";
import { subtitleRef } from "./subtitle.ref";
import {
  addStyle,
  removeStyle,
  renameStyle,
  reorderStyles,
  updateStyle,
} from "./subtitle.style.commands";

/** Subtitles: styles of a composition and text clips marked as cues of them. */
export const subtitleModule = defineModule({
  ref: subtitleRef,
  name: "Subtitles",
  tier: "feature",
  requires: ["project", "element", "text", "fonts", "timeline"],
  commands: [
    addStyle,
    updateStyle,
    renameStyle,
    removeStyle,
    reorderStyles,
    mark,
    unmark,
    resetToStyle,
    addCue,
    splitCue,
    mergeCues,
    importSubtitles,
  ],
  mcpTools: subtitleMcpTools,
  setup: () => ({ api: {} }),
});
