import { Type } from "lucide-react";
import { defineModule, layoutPanels } from "@/core";
import { elements } from "@/modules/element";
import { propertyControls } from "@/modules/inspector";
import { previewOverlays } from "@/modules/preview";
import { textCommands } from "./text.commands";
import { textElement } from "./text.element";
import { textMcpTools } from "./text.mcp";
import { textRef } from "./text.ref";
import { TextEditOverlay, TextPanel } from "./ui";
import { textControls } from "./ui/controls";

/**
 * Text over the video: the text element (its values, panel and drawing), the Text tab (add or drag
 * a text onto the timeline: its `create` tiles), `text.applyPreset` and the controls its panel needs.
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
    contribute(propertyControls, ...textControls);
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
