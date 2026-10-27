import { defineModule } from "@/core";
import { projectCommands } from "./project.commands";
import { projectMcpTools } from "./project.mcp";
import { projectRef } from "./project.ref";
import { createProjectStore } from "./project.store";
import type { ProjectState } from "./project.types";

/**
 * Creates the project module: the document (format, media, tracks and clips). `initial` seeds
 * the document, e.g. in tests; by default it starts empty.
 */
export function createProjectModule(initial?: ProjectState) {
  return defineModule({
    ref: projectRef,
    name: "Project",
    tier: "core",
    commands: projectCommands,
    mcpTools: projectMcpTools,
    setup: () => ({ api: { store: createProjectStore(initial) } }),
  });
}

/** The project module the app loads. */
export const projectModule = createProjectModule();
