import { defineModule } from "@/core";
import { inspectorSections } from "@/modules/inspector";
import { audioCommands } from "./audio.commands";
import { audioMcpTools } from "./audio.mcp";
import { audioRef } from "./audio.ref";
import { audioSections } from "./ui";

/** How a clip sounds: commands, tools and the inspector's Audio tab. */
export const audioModule = defineModule({
  ref: audioRef,
  name: "Audio",
  tier: "feature",
  requires: ["project", "inspector", "preview"],
  commands: audioCommands,
  mcpTools: audioMcpTools,
  setup({ contribute }) {
    contribute(inspectorSections, ...audioSections);
    return { api: {} };
  },
});
