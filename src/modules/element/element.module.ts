import { defineModule } from "@/core";
import { elementCommands } from "./element.commands";
import { elementMcpTools } from "./element.mcp";
import { elementRef } from "./element.ref";
import { createElementApi } from "./element.registry";

/**
 * Kinds of clip: the `elements`, `sharedGroups` and `propTypes` points, the registry that reads
 * them, and the generic commands that change any element's values.
 */
export const elementModule = defineModule({
  ref: elementRef,
  name: "Elements",
  tier: "core",
  requires: ["project"],
  commands: elementCommands,
  mcpTools: elementMcpTools,
  setup({ points, log, onDispose }) {
    const api = createElementApi(points, log);
    onDispose(api.dispose);
    return { api };
  },
});
