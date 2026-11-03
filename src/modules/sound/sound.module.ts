import { AudioLines } from "lucide-react";
import { appPages, defineModule, pagesRef } from "@/core";
import { mediaRef } from "@/modules/media";
import { projectRef } from "@/modules/project";
import { settingsSections } from "@/modules/settings";
import { soundMcpTools } from "./sound.mcp";
import { soundEffectCommands } from "./sound.effects.commands";
import { soundDenoiseCommands } from "./sound.denoise.commands";
import { followDenoiseNeeds } from "./sound.denoise.follow";
import { soundMixCommands } from "./sound.mix.commands";
import { followSoundPageLeave } from "./sound.leave";
import { clearListening, soundMonitorCommands } from "./sound.monitor.commands";
import { soundPresetCommands } from "./sound.presets.commands";
import { createUserPresets } from "./sound.presets.store";
import { SOUND_PAGE, soundRef } from "./sound.ref";
import { createSoundView } from "./sound.store";
import { PresetsSection, SoundPage } from "./ui";

/** The Sound page with its mixer, and the mix: track and master levels, effects, mix A and B. */
export const soundModule = defineModule({
  ref: soundRef,
  name: "Sound",
  tier: "feature",
  requires: ["project", "timeline", "preview", "inspector", "audio", "settings", "media"],
  commands: [
    ...soundMixCommands,
    ...soundEffectCommands,
    ...soundDenoiseCommands,
    ...soundPresetCommands,
    ...soundMonitorCommands,
  ],
  mcpTools: soundMcpTools,
  setup({ bus, contribute, onDispose, require }) {
    const view = createSoundView();
    const presets = createUserPresets();
    onDispose(followDenoiseNeeds(require(projectRef).store.api, require(mediaRef)));
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
    contribute(settingsSections, {
      id: "sound.presets",
      label: "Sound presets",
      order: 20,
      component: PresetsSection,
    });
    return {
      api: {
        view,
        presets,
        select: (selected) => view.setState({ selected }),
        setExpanded: (expanded) => view.setState({ expanded }),
      },
    };
  },
});
