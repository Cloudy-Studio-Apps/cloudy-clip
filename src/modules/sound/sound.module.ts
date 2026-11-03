import { AudioLines } from "lucide-react";
import { appPages, defineModule } from "@/core";
import { soundRef } from "./sound.ref";
import { soundMcpTools } from "./sound.mcp";
import { soundMixCommands } from "./sound.mix.commands";
import { SoundPage } from "./ui";

/** The Sound page (empty for now) and the mix: track and master levels, mix A and B. */
export const soundModule = defineModule({
  ref: soundRef,
  name: "Sound",
  tier: "feature",
  requires: ["project"],
  commands: soundMixCommands,
  mcpTools: soundMcpTools,
  setup({ contribute }) {
    contribute(appPages, {
      id: "sound.page",
      label: "Sound",
      icon: AudioLines,
      order: 30,
      component: SoundPage,
    });
    return { api: {} };
  },
});
