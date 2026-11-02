import { defineModule } from "@/core";
import { inspectorSections } from "@/modules/inspector";
import { clipActions, timelineRef } from "@/modules/timeline";
import { audioCommands } from "./audio.commands";
import { audioMcpTools } from "./audio.mcp";
import { audioMenu } from "./audio.menu";
import { audioRef } from "./audio.ref";
import { audioSections } from "./ui";

/** How a clip sounds: commands, tools and the inspector's Audio tab. */
export const audioModule = defineModule({
  ref: audioRef,
  name: "Audio",
  tier: "feature",
  requires: ["project", "inspector", "preview", "timeline"],
  commands: audioCommands,
  mcpTools: audioMcpTools,
  setup(ctx) {
    const { contribute } = ctx;
    contribute(inspectorSections, ...audioSections);
    contribute(clipActions, audioMenu(ctx, ctx.require(timelineRef).view));
    return { api: {} };
  },
});
