import { defineModule } from "@/core";
import { speedCommands } from "./speed.commands";
import { speedMcpTools } from "./speed.mcp";
import { speedRef } from "./speed.ref";
import { createSpeedView } from "./speed.view.store";

/** How fast a clip plays: commands, tools, the box over the clip and the inspector section. */
export const speedModule = defineModule({
  ref: speedRef,
  name: "Speed",
  tier: "feature",
  requires: ["project", "junction", "timeline"],
  commands: speedCommands,
  mcpTools: speedMcpTools,
  setup() {
    return { api: { view: createSpeedView() } };
  },
});
