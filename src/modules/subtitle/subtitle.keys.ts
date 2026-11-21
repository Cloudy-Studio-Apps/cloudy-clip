import type { StoreApi } from "zustand";
import { pagesRef, type Keybinding, type KeybindingAction, type ModuleContext } from "@/core";
import { previewRef } from "@/modules/preview";
import { formatOf, frameDuration, projectRef, type Clip } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { SUBTITLE_PAGE } from "./subtitle.ref";
import { cueTimeAction } from "./subtitle.timing";
import type { CueTimeField, SubtitleViewState } from "./subtitle.types";

/**
 * The timing keys of the Subtitles page, with one cue selected (the key host skips them while
 * typing): `[` / `]` put its start / end at the playhead; Alt+Left / Alt+Right nudge the last edge
 * touched (`view.edge`) by one frame, with Shift the whole cue. Nothing on other pages.
 */
export function subtitleKeys(ctx: ModuleContext, view: StoreApi<SubtitleViewState>): Keybinding[] {
  const project = ctx.require(projectRef).store;
  const selectedCue = (): Clip | null => {
    if (ctx.require(pagesRef).store.getState().active !== SUBTITLE_PAGE) return null;
    const selection = ctx.require(timelineRef).view.getState().selection;
    const clip = selection.length === 1 ? project.getState().clips[selection[0]!] : undefined;
    return clip?.subtitle ? clip : null;
  };
  const set =
    (field: CueTimeField | "move", value: (clip: Clip, frame: number) => number) =>
    (): KeybindingAction | null => {
      const clip = selectedCue();
      if (!clip) return null;
      const state = project.getState();
      return cueTimeAction(state, clip, field, value(clip, frameDuration(formatOf(state, clip))))
        .action;
    };
  const atPlayhead = () => ctx.require(previewRef).playback.getTime();
  const edgeTime = (clip: Clip) =>
    view.getState().edge === "start" ? clip.start : clip.start + clip.duration;
  const nudge = (by: -1 | 1) => () => {
    const field = view.getState().edge;
    return set(field, (clip, frame) => edgeTime(clip) + by * frame)();
  };
  return [
    { id: "subtitle.startAtPlayhead", key: "[", resolve: set("start", atPlayhead) },
    { id: "subtitle.endAtPlayhead", key: "]", resolve: set("end", atPlayhead) },
    { id: "subtitle.nudgeEarlier", key: "arrowleft", alt: true, resolve: nudge(-1) },
    { id: "subtitle.nudgeLater", key: "arrowright", alt: true, resolve: nudge(1) },
    {
      id: "subtitle.moveEarlier",
      key: "arrowleft",
      alt: true,
      shift: true,
      resolve: set("move", (clip, frame) => clip.start - frame),
    },
    {
      id: "subtitle.moveLater",
      key: "arrowright",
      alt: true,
      shift: true,
      resolve: set("move", (clip, frame) => clip.start + frame),
    },
  ];
}
