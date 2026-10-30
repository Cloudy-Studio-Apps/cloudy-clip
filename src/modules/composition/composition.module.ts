import { appOverlays, defineModule } from "@/core";
import { librarySections } from "@/modules/media";
import { timelineOverlays, timelineTabs } from "@/modules/timeline";
import { compositionCommands } from "./composition.commands";
import { compositionMcpTools } from "./composition.mcp";
import { compositionRef } from "./composition.ref";
import { createCompositionUi } from "./composition.store";
import { CompositionDialogHost, CompositionSection, CompositionTabs, EmptyStart } from "./ui";

/** Compositions: their commands and tools, the dialog, the Library section and the tabs. */
export const compositionModule = defineModule({
  ref: compositionRef,
  name: "Compositions",
  tier: "core",
  requires: ["project", "media", "timeline"],
  commands: compositionCommands,
  mcpTools: compositionMcpTools,
  setup(ctx) {
    ctx.contribute(librarySections, { id: "composition.section", component: CompositionSection });
    ctx.contribute(timelineTabs, { id: "composition.tabs", component: CompositionTabs });
    ctx.contribute(timelineOverlays, { id: "composition.empty", component: EmptyStart });
    ctx.contribute(appOverlays, { id: "composition.dialog", component: CompositionDialogHost });
    return { api: createCompositionUi() };
  },
});
