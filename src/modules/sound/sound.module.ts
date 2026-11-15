import { AudioLines } from "lucide-react";
import { LOCAL_ACTOR, appOverlays, appPages, defineModule, pagesRef } from "@/core";
import { loudnessMatchers } from "@/modules/export";
import { mediaRef } from "@/modules/media";
import { projectRef } from "@/modules/project";
import { settingsSections } from "@/modules/settings";
import {
  clipActions,
  timelineRef,
  timelineOverlays,
  timelineSnapTargets,
  timelineTools,
  timelineTrackControls,
} from "@/modules/timeline";
import { previewRef } from "@/modules/preview";
import { workspaceRef } from "@/modules/workspace";
import { soundMcpTools } from "./sound.mcp";
import { createAutomation } from "./sound.automation";
import { soundClipLineCommands } from "./sound.clipline.commands";
import { createAnalysisStore } from "./sound.analysis.store";
import { createAnalyzer } from "./sound.analysis";
import { createMatcher } from "./sound.match";
import { createBeatFinder } from "./sound.beats";
import { createBeatsStore } from "./sound.beats.store";
import { soundBeatCommands } from "./sound.beats.commands";
import { createLoudnessMeter } from "./sound.loudness";
import { createSilenceFinder } from "./sound.silence";
import { silenceMenu } from "./sound.menu";
import { soundToolsCommands } from "./sound.tools.commands";
import { rememberedBeats } from "./logic/beats";
import { soundEffectCommands } from "./sound.effects.commands";
import { soundDeliveryCommands } from "./sound.delivery.commands";
import { soundDenoiseCommands } from "./sound.denoise.commands";
import { followCompositionsGone } from "./sound.analysis.follow";
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
import type { SoundApi } from "./sound.types";
import { createSoundView, setAutomationMode, setLineInFront } from "./sound.store";
import {
  ArmButton,
  AutomationNote,
  BeatTicks,
  ClipLineKeys,
  ClipVolumeLine,
  DrawVolumeTool,
  LineViewButton,
  PresetsSection,
  RecordingTake,
  SheetNote,
  SilenceCuts,
  SoloButton,
  StripSilenceHost,
  MatchLevelHost,
  SoundPage,
  MasterLine,
  PointerLayer,
  ProblemMarks,
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
    "export",
  ],
  commands: [
    ...soundMixCommands,
    ...soundBusCommands,
    ...soundLineCommands,
    ...soundClipLineCommands,
    ...soundEffectCommands,
    ...soundDeliveryCommands,
    ...soundDenoiseCommands,
    ...soundPresetCommands,
    ...soundMonitorCommands,
    ...soundRecordCommands,
    ...soundBeatCommands,
    ...soundToolsCommands,
  ],
  mcpTools: soundMcpTools,
  setup({ bus, contribute, log, onDispose, require }) {
    const view = createSoundView();
    const presets = createUserPresets();
    onDispose(followDenoiseNeeds(require(projectRef).store.api, require(mediaRef)));
    const pages = require(pagesRef).store;
    onDispose(followSoundPageLeave(pages, () => void bus.run(clearListening, {})));
    const project = require(projectRef);
    const preview = require(previewRef);
    const { playback } = preview;
    const workspace = require(workspaceRef);
    const analyzer = createAnalyzer(createAnalysisStore(), project.store.getState, log);
    onDispose(analyzer.dispose);
    const matcher = createMatcher({ analyzer, bus, project: project.store.getState, log });
    onDispose(matcher.dispose);
    onDispose(followCompositionsGone(project.store.api, analyzer, matcher));
    contribute(loudnessMatchers, { id: "sound.match", match: matcher.match });
    const beats = createBeatFinder(createBeatsStore(), log);
    onDispose(beats.cancel);
    const beatTimes = rememberedBeats();
    contribute(timelineSnapTargets, {
      id: "sound.beats",
      times: (state, compositionId) =>
        beatTimes(state, compositionId, beats.state.getState().files),
    });
    const media = require(mediaRef);
    const silences = createSilenceFinder(project.store.getState, media);
    const openSilence: SoundApi["openSilence"] = (target) =>
      view.setState({ silence: target && { ...target, cuts: [] } });
    onDispose(() => {
      silences.cancel();
      silences.forget();
    });
    const loudness = createLoudnessMeter(project.store.getState, media);
    const openMatch: SoundApi["openMatch"] = (target) => view.setState({ match: target });
    onDispose(() => {
      loudness.cancel();
      loudness.forget();
    });
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
    contribute(timelineOverlays, {
      id: "sound.problemMarks",
      scopes: ["all", "sound"],
      component: ProblemMarks,
    });
    contribute(timelineOverlays, {
      id: "sound.beatTicks",
      scopes: ["all", "sound"],
      component: BeatTicks,
    });
    contribute(timelineOverlays, {
      id: "sound.masterLine",
      scopes: ["sound"],
      component: MasterLine,
    });
    contribute(appOverlays, { id: "sound.stripSilence", component: StripSilenceHost });
    contribute(appOverlays, { id: "sound.matchLevel", component: MatchLevelHost });
    contribute(timelineOverlays, {
      id: "sound.silenceCuts",
      scopes: ["all", "sound"],
      component: SilenceCuts,
    });
    contribute(clipActions, {
      ...silenceMenu(project, media, require(timelineRef).view, openSilence),
      scopes: ["all"],
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
        analyzer,
        matcher,
        beats,
        silences,
        openSilence,
        loudness,
        openMatch,
        setTool: (tool) => view.setState({ tool }),
        setAutomation: (target, mode, compositionId) =>
          setAutomationMode(view, target, mode, compositionId ?? project.view.openFor(LOCAL_ACTOR)),
        setLineView: (trackId, inFront) => setLineInFront(view, trackId, inFront),
      },
    };
  },
});
