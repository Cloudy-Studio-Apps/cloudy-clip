import { Type } from "lucide-react";
import { defineModule, layoutPanels } from "@/core";
import { textCommands } from "./text.commands";
import { textMcpTools } from "./text.mcp";
import { textRef } from "./text.ref";
import { TextPanel } from "./ui";

/**
 * Text over the video: the Text tab (add or drag a text onto the timeline) and the `text.add`
 * command (MCP `text_add`). Text clips are moved and trimmed like any clip, and placed in the
 * frame with the transform tools.
 */
export const textModule = defineModule({
  ref: textRef,
  name: "Text",
  tier: "feature",
  requires: ["project", "preview", "timeline", "transform", "fonts"],
  commands: textCommands,
  mcpTools: textMcpTools,
  setup({ contribute }) {
    contribute(layoutPanels, {
      id: "text.panel",
      title: "Text",
      slot: "side",
      icon: Type,
      component: TextPanel,
    });
    return { api: {} };
  },
});
