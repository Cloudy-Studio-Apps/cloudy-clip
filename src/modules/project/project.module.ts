import { defineModule } from "@/core";
import { projectCommands } from "./project.commands";
import { projectMcpTools } from "./project.mcp";
import { projectRef } from "./project.ref";

/** The project document: format, media, tracks and clips. */
export const projectModule = defineModule({
  ref: projectRef,
  name: "Project",
  tier: "core",
  commands: projectCommands,
  mcpTools: projectMcpTools,
});
