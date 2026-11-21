import { EDITOR_PAGE, type AppPage, type TimelineScopeName } from "@/core";
import type { Clip, ProjectState, Track, TrackKind } from "@/modules/project";
import { HEADER_WIDTH, SOUND_HEADER_WIDTH } from "../timeline.layout";
import type { Scoped } from "../timeline.types";

/** Whether an entry shows in a scope. An entry without `scopes` shows in `"all"` only. */
export function inScope(entry: Scoped, scope: TimelineScopeName): boolean {
  return (entry.scopes ?? ["all"]).includes(scope);
}

/** The scope of the timeline on the active page: its `timelineScope`, or `"all"`. */
export function activeScope(pages: readonly AppPage[], active: string): TimelineScopeName {
  if (active === EDITOR_PAGE) return "all";
  return pages.find((page) => page.id === active)?.timelineScope ?? "all";
}

/**
 * Whether a kind of track may be offered or added in a scope: `"sound"` lists audio only, and
 * `"subtitle"` none (its tracks are the ones that hold cues). The one place that says what a
 * scoped timeline may show and edit.
 */
export function kindInScope(kind: TrackKind, scope: TimelineScopeName): boolean {
  if (scope === "subtitle") return false;
  return scope !== "sound" || kind === "audio";
}

/** Whether a clip is drawn in a scope: on `"subtitle"`, only the marked ones (cues). */
export function clipInScope(clip: Clip, scope: TimelineScopeName): boolean {
  return scope !== "subtitle" || clip.subtitle !== undefined;
}

/**
 * Whether a track is listed in a scope: on `"subtitle"`, a video track holding at least one
 * cue; on `"sound"`, an audio track.
 */
export function trackInScope(track: Track, scope: TimelineScopeName, state: ProjectState): boolean {
  if (scope !== "subtitle") return kindInScope(track.kind, scope);
  return (
    track.kind === "video" &&
    track.clipIds.some((id) => {
      const clip = state.clips[id];
      return clip !== undefined && clipInScope(clip, scope);
    })
  );
}

/** The clips a scope draws: on tracks it lists (`"sound"`: never a picture's), and on `"subtitle"` cues only. */
export function clipsInScope<C extends Clip>(
  state: ProjectState,
  clips: readonly C[],
  scope: TimelineScopeName,
): C[] {
  return clips.filter((clip) => {
    const track = state.tracks[clip.trackId];
    return track !== undefined && trackInScope(track, scope, state) && clipInScope(clip, scope);
  });
}

/**
 * Width of the track header column of a panel of a scope. The others use the shared `headerWidth`.
 * A sound-scope panel has its own base width, but follows a module that widened the shared one
 * (the keyframe dock), so what that module draws lines up with the lanes. The one place that says
 * so, for the panel and for zooming.
 */
export function headerWidthFor(scope: TimelineScopeName, shared: number): number {
  if (scope !== "sound") return shared;
  return shared > HEADER_WIDTH ? Math.max(SOUND_HEADER_WIDTH, shared) : SOUND_HEADER_WIDTH;
}
