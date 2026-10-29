import { defineModule, layoutPanels } from "@/core";
import { inspectorRef } from "./inspector.ref";
import { InspectorPanel } from "./ui";

/** The right column: shows the project, or the selected clips, as read-only details. */
export const inspectorModule = defineModule({
  ref: inspectorRef,
  name: "Inspector",
  tier: "feature",
  requires: ["project", "element", "preview", "timeline"],
  commands: [],
  mcpTools: [],
  setup({ contribute }) {
    contribute(layoutPanels, {
      id: "inspector.panel",
      title: "Inspector",
      slot: "inspector",
      component: InspectorPanel,
    });
    return { api: {} };
  },
});
