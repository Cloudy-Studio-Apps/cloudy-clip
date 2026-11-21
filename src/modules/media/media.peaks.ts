import { createLogger, notify } from "@/core";
import type { MediaId } from "@/modules/project";
import type { MediaApi } from "./media.types";

const log = createLogger("media");

/** Peaks per second of a file's sound. */
export const PEAKS_PER_SECOND = 50;

/**
 * The sound peaks of this kernel's files, scanned once per file (and per revision, so a relinked
 * file is scanned again), one scan in flight per file. A failure is reported once.
 * @param scan Reads the peaks of a file by path; an empty result means no sound.
 * @param pathOf The original file's path (never a proxy), once known.
 */
export function createPeaks(
  scan: (path: string) => Promise<Uint8Array>,
  pathOf: (id: MediaId) => string | undefined,
  revisionOf: (id: MediaId) => number | undefined,
): Pick<MediaApi, "peaks" | "peaksNow" | "onPeaks"> & { dispose(): void } {
  const key = (id: MediaId) => `${id}@${revisionOf(id) ?? 0}`;
  const done = new Map<string, Uint8Array | null>();
  const pending = new Map<string, Promise<Uint8Array | null>>();
  const failed = new Set<string>();
  const listeners = new Set<(id: MediaId) => void>();
  let disposed = false;

  return {
    peaks(id) {
      const k = key(id);
      const known = done.get(k);
      if (known !== undefined) return Promise.resolve(known);
      const running = pending.get(k);
      if (running) return running;
      const path = pathOf(id);
      if (!path) return Promise.resolve(null);
      const job = scan(path)
        .then((bytes) => {
          const peaks = bytes.length > 0 ? bytes : null;
          if (disposed) return peaks;
          done.set(k, peaks);
          for (const listener of listeners) listener(id);
          return peaks;
        })
        .catch((error: unknown) => {
          // A scan cancelled because the kernel is going away is no failure to report.
          if (disposed) return null;
          log.warn("Reading the sound of a file failed", error);
          if (!failed.has(k)) {
            failed.add(k);
            notify("error", "Couldn't read the sound of a file. Is FFmpeg installed?");
          }
          return null;
        })
        .finally(() => pending.delete(k));
      pending.set(k, job);
      return job;
    },
    peaksNow: (id) => done.get(key(id)) ?? undefined,
    onPeaks(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      listeners.clear();
    },
  };
}
