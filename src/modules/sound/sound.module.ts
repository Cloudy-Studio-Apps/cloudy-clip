import { AudioLines } from "lucide-react";
import { appPages, defineModule, pagesRef } from "@/core";
import { mediaRef } from "@/modules/media";
import { projectRef } from "@/modules/project";
import { settingsSections } from "@/modules/settings";
import { timelineOverlays } from "@/modules/timeline";
import { previewRef } from "@/modules/preview";
import { workspaceRef } from "@/modules/workspace";
import { soundMcpTools } from "./sound.mcp";
import { soundEffectCommands } from "./sound.effects.commands";
import { soundDenoiseCommands } from "./sound.denoise.commands";
import { followDenoiseNeeds } from "./sound.denoise.follow";
import { soundMixCommands } from "./sound.mix.commands";
import { followSoundPageLeave } from "./sound.leave";
import { clearListening, soundMonitorCommands } from "./sound.monitor.commands";
import { soundPresetCommands } from "./sound.presets.commands";
import { createRecorder } from "./sound.record";
import { soundRecordCommands } from "./sound.record.commands";
import { followRecordingEnds } from "./sound.record.follow";
import { createUserPresets } from "./sound.presets.store";
import { SOUND_PAGE, soundRef } from "./sound.ref";
import { createSoundView } from "./sound.store";
import { PresetsSection, RecordingTake, SoundPage } from "./ui";

/** The Sound page with its mixer, and the mix: track and master levels, effects, mix A and B. */
export const soundModule = defineModule({
  ref: soundRef,
  name: "Sound",
  tier: "feature",
  requires: [
    "project",
    "timeline",
    "preview",
    "inspector",
    "audio",
    "settings",
    "media",
    "workspace",
  ],
  commands: [
    ...soundMixCommands,
    ...soundEffectCommands,
    ...soundDenoiseCommands,
    ...soundPresetCommands,
    ...soundMonitorCommands,
    ...soundRecordCommands,
  ],
  mcpTools: soundMcpTools,
  setup({ bus, contribute, onDispose, require }) {
    const view = createSoundView();
    const presets = createUserPresets();
    onDispose(followDenoiseNeeds(require(projectRef).store.api, require(mediaRef)));
    const pages = require(pagesRef).store;
    onDispose(followSoundPageLeave(pages, () => void bus.run(clearListening, {})));
    const project = require(projectRef);
    const { playback } = require(previewRef);
    const workspace = require(workspaceRef);
    const recorder = createRecorder({ bus, playback, project, session: workspace.session });
    onDispose(() => void recorder.stop());
    onDispose(followRecordingEnds(recorder, pages, playback, project, workspace));
    contribute(appPages, {
      id: SOUND_PAGE,
      label: "Sound",
      icon: AudioLines,
      order: 30,
      component: SoundPage,
      keepsPlayback: true,
      timelineScope: "sound",
    });
    contribute(timelineOverlays, {
      id: "sound.recordingTake",
      scopes: ["sound"],
      component: RecordingTake,
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
        recorder,
        arm(armed) {
          if (recorder.state.getState().status === "idle") view.setState({ armed });
        },
      },
    };
  },
});
