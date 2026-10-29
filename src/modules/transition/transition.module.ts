import { Blend } from "lucide-react";
import { defineModule, layoutPanels } from "@/core";
import { propTypes } from "@/modules/element";
import { propertyControls } from "@/modules/inspector";
import { junctionKinds } from "@/modules/junction";
import { builtInPresets } from "./presets/presets";
import { transitionCommands } from "./transition.commands";
import { createTransitionKind } from "./transition.kind";
import { transitionMcpTools } from "./transition.mcp";
import { createTransitionApi, transitionOptionsType } from "./transition.options";
import { transitionRef } from "./transition.ref";
import { transitionPresets } from "./transition.points";
import { TransitionsPanel } from "./ui";
import { transitionControls } from "./ui/controls";

/**
 * Transitions: the `transition` junction kind, the `transitionPresets` point, the
 * `transition-options` value type, the `transition-preset` and `transition-options` inspector
 * controls, `transition.apply` and its tools.
 */
export const transitionModule = defineModule({
  ref: transitionRef,
  name: "Transitions",
  tier: "feature",
  requires: ["project", "element", "junction", "timeline", "inspector"],
  commands: transitionCommands,
  mcpTools: transitionMcpTools,
  setup({ contribute, points }) {
    const api = createTransitionApi(points);
    contribute(propTypes, transitionOptionsType);
    contribute(transitionPresets, ...builtInPresets);
    contribute(junctionKinds, createTransitionKind(api));
    contribute(propertyControls, ...transitionControls);
    contribute(layoutPanels, {
      id: "transition.panel",
      title: "Transitions",
      slot: "side",
      icon: Blend,
      component: TransitionsPanel,
    });
    return { api };
  },
});
