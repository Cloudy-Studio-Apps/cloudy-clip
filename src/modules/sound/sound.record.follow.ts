import type { StoreApi } from "zustand/vanilla";
import { LOCAL_ACTOR, type PagesState } from "@/core";
import type { PlaybackClock } from "@/modules/preview";
import type { ProjectApi } from "@/modules/project";
import type { WorkspaceApi } from "@/modules/workspace";
import { followSoundPageLeave } from "./sound.leave";
import type { Recorder } from "./sound.types";

/**
 * Stops a take, and places it, when the user leaves it behind: the Sound page closes, another
 * composition opens, the project is about to be left (the workspace's `beforeLeave`: another
 * opened, a new one, the window closed; the take lands in this project before it's written, and
 * `workspace.new` / `open` refuse with `workspace.recording` while one is under way), the user
 * pauses, or plays again after playback reached the end. Reaching the end doesn't stop it. Returns
 * what stops following.
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
      if (status() !== "recording") return;
      // Playing again (from the start, after the end) would put the take out of time: it ends.
      if (playback.isPlaying()) return void recorder.stop({ pause: false });
      const duration =
        open === null ? 0 : (project.store.getState().compositions[open]?.duration ?? 0);
      if (playback.getTime() < duration) void recorder.stop();
    }),
    workspace.beforeLeave({
      finish: () => recorder.stop(),
      blocking: () =>
        status() === "idle"
          ? null
          : {
              code: "workspace.recording",
              message: "The user is recording a take. It's placed when they stop; ask them to.",
            },
    }),
  ];
  return () => offs.forEach((off) => off());
}
