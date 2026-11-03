import { AudioLines } from "lucide-react";
import { appPages, defineModule } from "@/core";
import { soundMcpTools } from "./sound.mcp";
import { soundMixCommands } from "./sound.mix.commands";
import { soundMonitorCommands } from "./sound.monitor.commands";
import { SOUND_PAGE, soundRef } from "./sound.ref";
import { createSoundView } from "./sound.store";
import { SoundPage } from "./ui";

/** The Sound page with its mixer, and the mix: track and master levels, mix A and B. */
export const soundModule = defineModule({
  ref: soundRef,
  name: "Sound",
  tier: "feature",
  requires: ["project", "timeline", "preview", "inspector"],
  commands: [...soundMixCommands, ...soundMonitorCommands],
  mcpTools: soundMcpTools,
  setup({ contribute }) {
    const view = createSoundView();
    contribute(appPages, {
      id: SOUND_PAGE,
      label: "Sound",
      icon: AudioLines,
      order: 30,
      component: SoundPage,
      keepsPlayback: true,
      timelineScope: "sound",
    });
    return {
      api: {
        view,
        selectTrack: (selectedTrack) => view.setState({ selectedTrack }),
        setExpanded: (expanded) => view.setState({ expanded }),
      },
    };
  },
});
