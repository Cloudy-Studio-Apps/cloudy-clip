import { defineModule, type ActorId } from "@/core";
import { projectRef } from "@/modules/project";
import { keyAction } from "./ui";
import { keyframeCommands } from "./keyframe.commands";
import { createKeyframeApi, elementTarget } from "./keyframe.fields";
import { fieldActions } from "@/modules/inspector";
import { keyTargets } from "./keyframe.points";
import { keyframeMcpTools } from "./keyframe.mcp";
import { keyframeRef } from "./keyframe.ref";
import type { CopiedKeys, KeyframeClipboard } from "./keyframe.types";
import { createKeyframeView, pruneSelection } from "./keyframe.view.store";

/** Keys on a clip's values over time: commands and tools to add, move and remove them. */
export const keyframeModule = defineModule({
  ref: keyframeRef,
  name: "Keyframes",
  tier: "feature",
  requires: ["project", "element", "preview", "inspector"],
  commands: keyframeCommands,
  mcpTools: keyframeMcpTools,
  setup(ctx) {
    const view = createKeyframeView();
    const copied = new Map<ActorId, CopiedKeys>();
    const clipboard: KeyframeClipboard = {
      get: (actor) => copied.get(actor),
      set: (actor, keys) => void copied.set(actor, keys),
    };
    const project = ctx.require(projectRef).store;
    ctx.onDispose(
      project.subscribe((state, previous) => {
        if (state.clips !== previous.clips) pruneSelection(view, state.clips);
      }),
    );
    ctx.contribute(keyTargets, elementTarget(ctx));
    ctx.contribute(fieldActions, keyAction);
    return { api: createKeyframeApi(ctx, view, clipboard) };
  },
});
