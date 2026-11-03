import type { StoreApi } from "zustand/vanilla";
import { LOCAL_ACTOR, type PagesState } from "@/core";
import type { PlaybackClock } from "@/modules/preview";
import { frameDuration, type ProjectApi } from "@/modules/project";
import type { WorkspaceApi } from "@/modules/workspace";
import { followSoundPageLeave } from "./sound.leave";
import type { Recorder } from "./sound.types";

/** How far ahead of the time passed the playhead may be before it counts as a jump (µs). */
const FORWARD_SLACK_US = 250_000;

/**
 * Stops a take, and places it, when the user leaves it behind: the Sound page closes, another
 * composition opens, the project is about to be left (the workspace's `beforeLeave`: another
 * opened, a new one, the window closed; the take lands in this project before it's written, and
 * `workspace.new` / `open` refuse with `workspace.recording` while one is under way), the user
 * pauses, plays again after playback reached the end, or the playhead jumps by more than a frame
 * from where the time passed puts it (a ruler click or drag, Home, a marker, a seek from anywhere;
 * the loop doesn't wrap while a take records). What was recorded up to then is placed. Reaching
 * the end doesn't stop it. Returns what stops following.
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
  // Where the playhead was last, and when (ms): it may since have moved by the time passed.
  let last = { time: playback.getTime(), at: performance.now() };
  const offs = [
    playback.onTime((time) => {
      const now = performance.now();
      const moved = (now - last.at) * 1000;
      const before = last.time;
      last = { time, at: now };
      const composition = open === null ? undefined : project.store.getState().compositions[open];
      if (status() !== "recording" || !composition) return;
      // A seek or any other jump puts the playhead out of time with the take: it ends there.
      // Forward, the clock's time (from the frame's timestamp) can run ahead of `moved` (from
      // when this listener ran) by however long a slow frame held it, so a jump ahead must also
      // be past FORWARD_SLACK_US to count.
      const frame = frameDuration(composition.format);
      const ahead = Math.max(frame, FORWARD_SLACK_US);
      if (time < before - frame || time > before + moved + ahead) void recorder.stop();
    }),
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
