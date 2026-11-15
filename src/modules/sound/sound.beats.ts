import type { StoreApi } from "zustand";
import { createId, notify, type Logger } from "@/core";
import { rememberedBeats } from "./logic/beats";
import { cancelFileBeats, findFileBeats } from "./sound.service";
import type { BeatFinder, BeatsState } from "./sound.tools.types";

/** The message of a rejection from the native side (`{ code, message }`) or an `Error`. */
function messageOf(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String(error.message)
    : String(error);
}

/**
 * Creates the beat finder of a kernel: it asks the native side for each file's beats in turn,
 * keeps them by path in the store, and tells the user when a file fails (the others go on).
 */
export function createBeatFinder(state: StoreApi<BeatsState>, log: Logger): BeatFinder {
  let jobId: string | null = null;
  let cancelled = false;
  let done = Promise.resolve();
  const remembered = rememberedBeats();

  const run = async (paths: string[]) => {
    for (const [index, path] of paths.entries()) {
      if (cancelled) break;
      const id = createId("beats");
      jobId = id;
      const onProgress = (progress: number) => {
        if (state.getState().running) {
          state.setState({ running: { progress: (index + progress) / paths.length } });
        }
      };
      try {
        const beats = await findFileBeats(path, id, onProgress);
        state.setState((s) => ({ files: { ...s.files, [path]: beats } }));
      } catch (error) {
        const message = messageOf(error);
        if (cancelled || message === "Cancelled") break;
        log.error("Finding beats failed", error);
        notify("error", `Could not find the beats of ${path}: ${message}`);
        state.setState({ failed: message });
      }
    }
    jobId = null;
    state.setState({ running: null });
  };

  const cancel = () => {
    cancelled = true;
    if (jobId) void cancelFileBeats(jobId).catch(() => undefined);
  };

  return {
    state,
    find(paths) {
      if (state.getState().running) return false;
      cancelled = false;
      state.setState({ running: { progress: 0 }, failed: null });
      done = run(paths);
      return true;
    },
    cancel,
    settled: () => done,
    times: (project, compositionId) => remembered(project, compositionId, state.getState().files),
  };
}
