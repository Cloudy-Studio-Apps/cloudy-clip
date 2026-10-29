import { Type } from "lucide-react";
import { defineModule, layoutPanels } from "@/core";
import { inspectorSections } from "@/modules/inspector";
import { previewOverlays } from "@/modules/preview";
import { textCommands } from "./text.commands";
import { textMcpTools } from "./text.mcp";
import { textRef } from "./text.ref";
import { createRecentColors } from "./text.recents.store";
import {
  TextBackgroundSection,
  TextContentSection,
  TextEditOverlay,
  TextFillSection,
  TextFontSection,
  TextOutlineSection,
  TextPanel,
  TextShadowSection,
} from "./ui";

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
    contribute(layoutPanels, {
      id: "text.panel",
      title: "Text",
      slot: "side",
      icon: Type,
      component: TextPanel,
    });
    // After transform's overlay (text requires it), so the editor's layer sits on top.
    contribute(previewOverlays, { id: "text.editor", component: TextEditOverlay });
    const sections = [
      { id: "content", title: "Content", order: 10, component: TextContentSection },
      { id: "font", title: "Font", order: 20, component: TextFontSection },
      { id: "fill", title: "Fill", order: 30, component: TextFillSection },
      { id: "outline", title: "Outline", order: 40, component: TextOutlineSection },
      { id: "background", title: "Background", order: 50, component: TextBackgroundSection },
      { id: "shadow", title: "Shadow", order: 60, component: TextShadowSection },
    ];
    for (const section of sections) {
      contribute(inspectorSections, {
        ...section,
        id: `text.${section.id}`,
        appliesTo: (clip) => clip.kind === "text",
      });
    }
    return { api: { recents: createRecentColors() } };
  },
});
