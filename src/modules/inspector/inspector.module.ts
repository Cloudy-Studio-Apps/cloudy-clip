import { defineModule, layoutPanels } from "@/core";
import { createRecentColors } from "./inspector.recents.store";
import { propertyControls, sectionLayouts } from "./inspector.points";
import { inspectorRef } from "./inspector.ref";
import { InspectorPanel } from "./ui";
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
  requires: ["composition", "project", "element", "preview", "timeline", "junction"],
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
    return { api: { recents: createRecentColors() } };
  },
});
