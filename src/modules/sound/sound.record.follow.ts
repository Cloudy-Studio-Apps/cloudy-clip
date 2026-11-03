import type { StoreApi } from "zustand/vanilla";
import { LOCAL_ACTOR, type PagesState } from "@/core";
import type { PlaybackClock } from "@/modules/preview";
import type { ProjectApi } from "@/modules/project";
import type { WorkspaceApi } from "@/modules/workspace";
import { followSoundPageLeave } from "./sound.leave";
import type { Recorder } from "./sound.types";

/**
 * Stops a take, and places it, when the user leaves it behind: the Sound page closes, another
 * composition opens, the project is left (another opened, a new one, the window closed: through
 * the workspace's `beforeLeave`, so the take lands in this project before it's written), or the
 * user pauses. Playback reaching the composition's end doesn't stop it. Returns what stops following.
 */
export function followRecordingEnds(
  recorder: Recorder,
  pages: StoreApi<PagesState>,
  playback: PlaybackClock,
  project: ProjectApi,
  workspace: WorkspaceApi,
): () => void {
  const status = () => recorder.state.getState().status;
  let open = project.view.openFor(LOCAL_ACTOR);
  const offs = [
    followSoundPageLeave(pages, () => void recorder.stop()),
    project.view.store.subscribe(() => {
      const next = project.view.openFor(LOCAL_ACTOR);
      if (next !== open && status() !== "idle") void recorder.stop();
      open = next;
    }),
    playback.onPlayingChange(() => {
      if (playback.isPlaying() || status() !== "recording" || open === null) return;
      const duration = project.store.getState().compositions[open]?.duration ?? 0;
      if (playback.getTime() < duration) void recorder.stop();
    }),
    workspace.beforeLeave((run) => recorder.stop(run)),
  ];
  return () => offs.forEach((off) => off());
}
