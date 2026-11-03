import { EDITOR_PAGE, type AppPage, type TimelineScopeName } from "@/core";
import type { Clip, ProjectState, Track } from "@/modules/project";
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

/** Whether a track is listed in a scope: `"sound"` lists audio tracks only. */
export function trackInScope(track: Track, scope: TimelineScopeName): boolean {
  return scope !== "sound" || track.kind === "audio";
}

/** The clips that sit on tracks listed in a scope: on `"sound"`, never a picture's. */
export function clipsInScope<C extends Clip>(
  state: ProjectState,
  clips: readonly C[],
  scope: TimelineScopeName,
): C[] {
  return clips.filter((clip) => {
    const track = state.tracks[clip.trackId];
    return track !== undefined && trackInScope(track, scope);
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
