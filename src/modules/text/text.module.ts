import { Type } from "lucide-react";
import { defineModule, layoutPanels } from "@/core";
import { elements } from "@/modules/element";
import { previewOverlays } from "@/modules/preview";
import { textCommands } from "./text.commands";
import { textElement } from "./text.element";
import { textMcpTools } from "./text.mcp";
import { textRef } from "./text.ref";
import { TextEditOverlay, TextPanel } from "./ui";

/**
 * Text over the video: the Text tab (add or drag a text onto the timeline), the `text.*`
 * commands (MCP `text_*`) and the inspector sections that edit a text clip's words and look.
 */
export const textModule = defineModule({
  ref: textRef,
  name: "Text",
  tier: "feature",
  requires: ["project", "element", "preview", "timeline", "transform", "fonts", "inspector"],
  commands: textCommands,
  mcpTools: textMcpTools,
  setup({ contribute }) {
    contribute(elements, textElement);
    contribute(layoutPanels, {
      id: "text.panel",
      title: "Text",
      slot: "side",
      icon: Type,
      component: TextPanel,
    });
    // After transform's overlay (text requires it), so the editor's layer sits on top.
    contribute(previewOverlays, { id: "text.editor", component: TextEditOverlay });
    return { api: {} };
  },
});
