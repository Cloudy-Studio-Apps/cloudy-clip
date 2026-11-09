import { AudioLines } from "lucide-react";
import { appPages, defineModule, pagesRef } from "@/core";
import { mediaRef } from "@/modules/media";
import { projectRef } from "@/modules/project";
import { settingsSections } from "@/modules/settings";
import {
  clipActions,
  timelineOverlays,
  timelineTools,
  timelineTrackControls,
} from "@/modules/timeline";
import { previewRef } from "@/modules/preview";
import { workspaceRef } from "@/modules/workspace";
import { soundMcpTools } from "./sound.mcp";
import { createAutomation } from "./sound.automation";
import { soundClipLineCommands } from "./sound.clipline.commands";
import { soundEffectCommands } from "./sound.effects.commands";
import { soundDenoiseCommands } from "./sound.denoise.commands";
import { followDenoiseNeeds } from "./sound.denoise.follow";
import { soundLineCommands } from "./sound.line.commands";
import { soundBusCommands } from "./sound.bus.commands";
import { soundMixCommands } from "./sound.mix.commands";
import { followSoundPageLeave } from "./sound.leave";
import { clearListening, soundMonitorCommands } from "./sound.monitor.commands";
import { soundPresetCommands } from "./sound.presets.commands";
import { createRecorder } from "./sound.record";
import { soundRecordCommands } from "./sound.record.commands";
import { followRecordingEnds } from "./sound.record.follow";
import { createUserPresets } from "./sound.presets.store";
import { SOUND_PAGE, soundRef } from "./sound.ref";
import { createSoundView, setAutomationMode, setLineInFront } from "./sound.store";
import {
  ArmButton,
  AutomationNote,
  ClipLineKeys,
  ClipVolumeLine,
  DrawVolumeTool,
  LineViewButton,
  PresetsSection,
  RecordingTake,
  SheetNote,
  SoloButton,
  SoundPage,
  PointerLayer,
  TrackVolumeLine,
} from "./ui";

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
    "keyframe",
    "settings",
    "media",
    "workspace",
  ],
  commands: [
    ...soundMixCommands,
    ...soundBusCommands,
    ...soundLineCommands,
    ...soundClipLineCommands,
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
    const preview = require(previewRef);
    const { playback } = preview;
    const workspace = require(workspaceRef);
    const media = require(mediaRef);
    const recorder = createRecorder({ bus, preview, project, media, workspace, view });
    onDispose(() => void recorder.stop());
    onDispose(followRecordingEnds(recorder, pages, playback, project, workspace));
    const automation = createAutomation({ bus, preview, project, workspace, pages, view });
    onDispose(automation.dispose);
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
    contribute(timelineOverlays, {
      id: "sound.clipLineKeys",
      scopes: ["all", "sound"],
      component: ClipLineKeys,
    });
    contribute(timelineOverlays, {
      id: "sound.pointerLayer",
      scopes: ["sound"],
      component: PointerLayer,
    });
    contribute(timelineOverlays, {
      id: "sound.trackLine",
      scopes: ["all", "sound"],
      component: TrackVolumeLine,
    });
    contribute(clipActions, {
      id: "sound.clipLine",
      scopes: ["all", "sound"],
      badge: ClipVolumeLine,
    });
    contribute(
      timelineTrackControls,
      { id: "sound.solo", order: 10, scopes: ["sound"], component: SoloButton },
      { id: "sound.arm", order: 20, scopes: ["sound"], component: ArmButton },
      { id: "sound.lineView", order: 30, scopes: ["sound"], component: LineViewButton },
    );
    contribute(
      timelineTools,
      {
        id: "sound.drawVolume",
        order: 10,
        slot: "split",
        scopes: ["sound"],
        component: DrawVolumeTool,
      },
      {
        id: "sound.automation",
        order: 10,
        slot: "end",
        scopes: ["sound"],
        component: AutomationNote,
      },
      { id: "sound.sheetNote", order: 20, slot: "end", scopes: ["sound"], component: SheetNote },
    );
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
        setFilter: (filter) => view.setState({ filter }),
        recorder,
        arm: recorder.arm,
        automation,
        setTool: (tool) => view.setState({ tool }),
        setAutomation: (trackId, mode) => setAutomationMode(view, trackId, mode),
        setLineView: (trackId, inFront) => setLineInFront(view, trackId, inFront),
      },
    };
  },
});
