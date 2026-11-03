import { z } from "zod";
import { defineCommand } from "@/core";
import { timelineRef } from "@/modules/timeline";
import { PANEL_HEADER_WIDTH } from "./keyframe.layout";
import { keyframeRef } from "./keyframe.ref";

/** Switches the timeline between Normal, Keyframes and Curves. Moves the user's view, so no tool. */
export const toggleMode = defineCommand({
  id: "keyframe.toggleMode",
  label: "Switch keyframe view",
  description:
    "Shows the timeline as Normal, Keyframes or Curves. Without a mode it flips between Normal and the last keyframe view.",
  undoable: false,
  input: z.object({ mode: z.enum(["normal", "keys", "curves"]).optional() }),
  run(ctx, { mode }) {
    const { view } = ctx.require(keyframeRef);
    const timeline = ctx.require(timelineRef);
    const state = view.getState();
    const next = mode ?? (state.mode === "normal" ? state.last : "normal");
    if (next === "normal") {
      // The panel is gone, so its keys no longer take Delete and the shortcuts.
      view.setState({ mode: next, maximized: false, focused: false, selection: [] });
      timeline.setTracksHidden(false);
      timeline.setHeaderWidth(null);
    } else {
      view.setState({ mode: next, last: next });
      timeline.setHeaderWidth(PANEL_HEADER_WIDTH);
    }
    return { mode: next };
  },
});
