import { defineModule } from "@/core";
import { propTypes } from "@/modules/element";
import { junctionKinds } from "@/modules/junction";
import { transitionCommands } from "./transition.commands";
import { createTransitionKind } from "./transition.kind";
import { transitionMcpTools } from "./transition.mcp";
import { createTransitionApi, transitionOptionsType } from "./transition.options";
import { transitionRef } from "./transition.ref";

/**
 * Transitions: the `transition` junction kind, the `transitionPresets` point, the
 * `transition-options` value type, `transition.apply` and its tools.
 */
export const transitionModule = defineModule({
  ref: transitionRef,
  name: "Transitions",
  tier: "feature",
  requires: ["project", "element", "junction"],
  commands: transitionCommands,
  mcpTools: transitionMcpTools,
  setup({ contribute, points }) {
    const api = createTransitionApi(points);
    contribute(propTypes, transitionOptionsType);
    contribute(junctionKinds, createTransitionKind(api));
    return { api };
  },
});
