import { appOverlays, defineModule } from "@/core";
import { inspectorSections } from "@/modules/inspector";
import { keyTargets } from "@/modules/keyframe";
import { clipActions, timelineRef } from "@/modules/timeline";
import { speedCommands } from "./speed.commands";
import { speedMcpTools } from "./speed.mcp";
import { speedMenu } from "./speed.menu";
import { speedKeys } from "./speed.keys";
import { speedRef } from "./speed.ref";
import { createSpeedView } from "./speed.view.store";
import { speedSection, SpeedBox } from "./ui";

/** How fast a clip plays: commands, tools, the box over the clip and the inspector section. */
export const speedModule = defineModule({
  ref: speedRef,
  name: "Speed",
  tier: "feature",
  requires: ["project", "junction", "media", "timeline", "preview", "inspector", "keyframe"],
  commands: speedCommands,
  mcpTools: speedMcpTools,
  setup(ctx) {
    const view = createSpeedView();
    ctx.contribute(clipActions, speedMenu(ctx, ctx.require(timelineRef).view, view));
    ctx.contribute(appOverlays, { id: "speed.box", component: SpeedBox });
    ctx.contribute(inspectorSections, speedSection);
    ctx.contribute(keyTargets, speedKeys(ctx, view));
    return { api: { view } };
  },
});
