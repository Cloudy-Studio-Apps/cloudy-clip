import { defineModule } from "@/core";
import { projectMcpTools } from "./project.mcp";
import { projectRef } from "./project.ref";
import { createProjectStore } from "./project.store";
import type { ProjectState } from "./project.types";
import { createCompositionView } from "./project.view";

/**
 * Creates the project module: the document (compositions, media, tracks and clips). `initial` seeds
 * the document, e.g. in tests; by default it starts empty.
 */
export function createProjectModule(initial?: ProjectState) {
  return defineModule({
    ref: projectRef,
    name: "Project",
    tier: "core",
    mcpTools: projectMcpTools,
    setup(ctx) {
      const store = createProjectStore(initial);
      const view = createCompositionView(store);
      ctx.onDispose(() => view.dispose());
      return { api: { store, view } };
    },
  });
}

/** The project module the app loads. */
export const projectModule = createProjectModule();
