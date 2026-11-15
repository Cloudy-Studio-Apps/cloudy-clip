import type { StoreApi } from "zustand/vanilla";
import { appOverlays, type ModuleContext } from "@/core";
import { mediaRef } from "@/modules/media";
import { projectRef } from "@/modules/project";
import {
  clipActions,
  timelineOverlays,
  timelineRef,
  timelineSnapTargets,
} from "@/modules/timeline";
import { createBeatFinder } from "./sound.beats";
import { createBeatsStore } from "./sound.beats.store";
import { createLoudnessMeter } from "./sound.loudness";
import { silenceMenu } from "./sound.menu";
import { createAgentScans } from "./sound.scans";
import { createSilenceFinder } from "./sound.silence";
import type { SoundApi, SoundViewState } from "./sound.types";
import { BeatTicks, MatchLevelHost, SilenceCuts, StripSilenceHost } from "./ui";

/**
 * Wires the quick tools of a kernel: Find beats (ticks and a snap target), Strip silence and
 * Match level (their finders, dialogs and marks), and the record of agents' scans. Wiring only.
 */
export function setupQuickTools(
  { contribute, log, onDispose, require }: ModuleContext,
  view: StoreApi<SoundViewState>,
): Pick<SoundApi, "beats" | "silences" | "openSilence" | "loudness" | "openMatch" | "scans"> {
  const project = require(projectRef);
  const media = require(mediaRef);
  const beats = createBeatFinder(createBeatsStore(), log);
  onDispose(beats.cancel);
  contribute(timelineSnapTargets, { id: "sound.beats", times: beats.times });
  const silences = createSilenceFinder(project.store.getState, media);
  onDispose(() => {
    silences.cancelAll();
    silences.forget();
  });
  const loudness = createLoudnessMeter(project.store.getState, media);
  onDispose(() => {
    loudness.cancelAll();
    loudness.forget();
  });
  const openSilence: SoundApi["openSilence"] = (target) =>
    view.setState({ silence: target && { ...target, cuts: [] } });
  const openMatch: SoundApi["openMatch"] = (target) => view.setState({ match: target });
  contribute(timelineOverlays, {
    id: "sound.beatTicks",
    scopes: ["all", "sound"],
    component: BeatTicks,
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
  return { beats, silences, openSilence, loudness, openMatch, scans: createAgentScans() };
}
