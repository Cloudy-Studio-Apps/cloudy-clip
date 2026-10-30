import { appOverlays, defineModule, topBarItems } from "@/core";
import { previewRef } from "@/modules/preview";
import { timelineOverlays, timelineRef } from "@/modules/timeline";
import { collabCommands } from "./collab.commands";
import { collabMcpTools } from "./collab.mcp";
import { createCollabNotes } from "./collab.notes";
import { createCollabObserver } from "./collab.observer";
import { startPresence } from "./collab.presence";
import { collabRef } from "./collab.ref";
import { createCollabStore } from "./collab.store";
import { AgentPlayheads, AgentPointers, AgentStatusStrip, CollabAvatars } from "./ui";

/** Connected agents as collaborators: presence, access, and their place in the app. */
export const collabModule = defineModule({
  ref: collabRef,
  name: "Collaboration",
  tier: "feature",
  requires: ["preview", "timeline"],
  commands: collabCommands,
  mcpTools: collabMcpTools,
  setup(ctx) {
    const store = createCollabStore();
    const notes = createCollabNotes();
    ctx.history.scopeUndo();
    ctx.history.nameActors((id) => store.getState().collaborators[id]?.name ?? "Someone");
    ctx.onDispose(ctx.mcp.observe(createCollabObserver(store, notes)));
    ctx.onDispose(
      startPresence(store, notes, {
        bus: ctx.bus,
        history: ctx.history,
        preview: ctx.require(previewRef),
        timeline: ctx.require(timelineRef),
      }),
    );
    ctx.contribute(
      topBarItems,
      { id: "collab.status", slot: "center", component: AgentStatusStrip },
      { id: "collab.avatars", slot: "right", component: CollabAvatars },
    );
    ctx.contribute(appOverlays, { id: "collab.pointers", component: AgentPointers });
    ctx.contribute(timelineOverlays, { id: "collab.playheads", component: AgentPlayheads });
    return { api: { store } };
  },
});
