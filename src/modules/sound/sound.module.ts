import { AudioLines } from "lucide-react";
import { appPages, defineModule, pagesRef } from "@/core";
import { soundMcpTools } from "./sound.mcp";
import { soundEffectCommands } from "./sound.effects.commands";
import { soundMixCommands } from "./sound.mix.commands";
import { followSoundPageLeave } from "./sound.leave";
import { clearListening, soundMonitorCommands } from "./sound.monitor.commands";
import { SOUND_PAGE, soundRef } from "./sound.ref";
import { createSoundView } from "./sound.store";
import { SoundPage } from "./ui";

/** The Sound page with its mixer, and the mix: track and master levels, effects, mix A and B. */
export const soundModule = defineModule({
  ref: soundRef,
  name: "Sound",
  tier: "feature",
  requires: ["project", "timeline", "preview", "inspector"],
  commands: [...soundMixCommands, ...soundEffectCommands, ...soundMonitorCommands],
  mcpTools: soundMcpTools,
  setup({ bus, contribute, onDispose, require }) {
    const view = createSoundView();
    onDispose(
      followSoundPageLeave(require(pagesRef).store, () => void bus.run(clearListening, {})),
    );
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
        select: (selected) => view.setState({ selected }),
        setExpanded: (expanded) => view.setState({ expanded }),
      },
    };
  },
});
