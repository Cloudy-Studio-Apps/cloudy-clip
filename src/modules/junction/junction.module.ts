import { defineModule } from "@/core";
import { junctionRef } from "./junction.ref";
import { junctionCommands } from "./junction.commands";
import { junctionMcpTools } from "./junction.mcp";
import { createJunctionApi } from "./junction.registry";

/**
 * Kinds of junction (what sits on the cut between two clips): the `junctionKinds` point and the
 * registry that reads it.
 */
export const junctionModule = defineModule({
  ref: junctionRef,
  name: "Junctions",
  tier: "core",
  requires: ["project", "element"],
  commands: junctionCommands,
  mcpTools: junctionMcpTools,
  setup({ points, log, onDispose }) {
    const api = createJunctionApi(points, log);
    onDispose(api.dispose);
    return { api };
  },
});
