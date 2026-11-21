import { Captions } from "lucide-react";
import { appPages, defineModule, keybindings } from "@/core";
import { timelineOverlays } from "@/modules/timeline";
import { addCue, mergeCues, splitCue } from "./subtitle.cue.commands";
import { importSubtitles } from "./subtitle.import.command";
import { subtitleKeys } from "./subtitle.keys";
import { mark, resetToStyle, unmark } from "./subtitle.mark.commands";
import { subtitleMcpTools } from "./subtitle.mcp";
import { SUBTITLE_PAGE, subtitleRef } from "./subtitle.ref";
import { createSubtitleView } from "./subtitle.store";
import {
  addStyle,
  removeStyle,
  renameStyle,
  reorderStyles,
  updateStyle,
} from "./subtitle.style.commands";
import { ContextBand, SubtitlePage } from "./ui";

/** Subtitles: styles of a composition, text clips marked as cues of them, and the Subtitles page. */
export const subtitleModule = defineModule({
  ref: subtitleRef,
  name: "Subtitles",
  tier: "feature",
  requires: ["project", "element", "text", "fonts", "timeline", "preview", "media", "transform"],
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
  setup(ctx) {
    const view = createSubtitleView();
    ctx.contribute(appPages, {
      id: SUBTITLE_PAGE,
      label: "Subtitles",
      icon: Captions,
      order: 22,
      component: SubtitlePage,
      keepsPlayback: true,
      timelineScope: "subtitle",
    });
    ctx.contribute(timelineOverlays, {
      id: "subtitle.context",
      scopes: ["subtitle"],
      component: ContextBand,
    });
    ctx.contribute(keybindings, ...subtitleKeys(ctx, view));
    return { api: { view } };
  },
});
