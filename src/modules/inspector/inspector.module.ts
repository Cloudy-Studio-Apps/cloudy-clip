import { defineModule, layoutPanels } from "@/core";
import { Blend, FileText, Music, SquarePlay } from "lucide-react";
import {
  fieldActions,
  inspectorSections,
  inspectorTabs,
  propertyControls,
  sectionLayouts,
} from "./inspector.points";
import { createRecentColors } from "./inspector.recents.store";
import { inspectorRef } from "./inspector.ref";
import { createInspectorView } from "./inspector.view.store";
import { builtinSections, InspectorPanel, resetAction } from "./ui";
import { builtinControls } from "./ui/controls";
import { PanelSection } from "./ui/PanelSection";

/**
 * The right column: the project, or the selected clip's panel generated from its element (each
 * value with its control, live while dragging, one command on release).
 */
export const inspectorModule = defineModule({
  ref: inspectorRef,
  name: "Inspector",
  tier: "feature",
  requires: ["composition", "project", "element", "preview", "timeline", "junction", "media"],
  commands: [],
  mcpTools: [],
  setup({ contribute }) {
    contribute(layoutPanels, {
      id: "inspector.panel",
      title: "Inspector",
      slot: "inspector",
      component: InspectorPanel,
    });
    contribute(propertyControls, ...builtinControls);
    contribute(sectionLayouts, { id: "section", component: PanelSection });
    contribute(
      inspectorTabs,
      { id: "video", label: "Video", icon: SquarePlay, order: 100 },
      { id: "audio", label: "Audio", icon: Music, order: 200 },
      { id: "transition", label: "Transition", icon: Blend, order: 300 },
      { id: "file", label: "File", icon: FileText, order: 400 },
    );
    contribute(inspectorSections, ...builtinSections);
    contribute(fieldActions, resetAction);
    return { api: { recents: createRecentColors(), view: createInspectorView() } };
  },
});
