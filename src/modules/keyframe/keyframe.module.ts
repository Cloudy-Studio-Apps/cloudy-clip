import { defineModule } from "@/core";
import { projectRef } from "@/modules/project";
import { keyframeCommands } from "./keyframe.commands";
import { createKeyframeApi, elementTarget } from "./keyframe.fields";
import { keyTargets } from "./keyframe.points";
import { keyframeMcpTools } from "./keyframe.mcp";
import { keyframeRef } from "./keyframe.ref";
import { createKeyframeView, pruneSelection } from "./keyframe.view.store";

/** Keys on a clip's values over time: commands and tools to add, move and remove them. */
export const keyframeModule = defineModule({
  ref: keyframeRef,
  name: "Keyframes",
  tier: "feature",
  requires: ["project", "element"],
  commands: keyframeCommands,
  mcpTools: keyframeMcpTools,
  setup(ctx) {
    const view = createKeyframeView();
    const project = ctx.require(projectRef).store;
    ctx.onDispose(
      project.subscribe((state, previous) => {
        if (state.clips !== previous.clips) pruneSelection(view, state.clips);
      }),
    );
    ctx.contribute(keyTargets, elementTarget(ctx));
    return { api: createKeyframeApi(ctx, view) };
  },
});
