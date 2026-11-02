import { defineModule } from "@/core";
import { audioCommands } from "./audio.commands";
import { audioMcpTools } from "./audio.mcp";
import { audioRef } from "./audio.ref";

/** How a clip sounds: commands, tools and the inspector's Audio tab. */
export const audioModule = defineModule({
  ref: audioRef,
  name: "Audio",
  tier: "feature",
  requires: ["project"],
  commands: audioCommands,
  mcpTools: audioMcpTools,
  setup() {
    return { api: {} };
  },
});
