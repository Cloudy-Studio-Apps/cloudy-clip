import { createLogger, notify } from "@/core";
import type { MediaId } from "@/modules/project";
import type { MediaApi, MediaService } from "./media.types";

const log = createLogger("media");

/**
 * The jobs making derived files in this kernel, by key: asking again while one runs joins it,
 * and what's done is remembered, so a file is never made twice.
 */
function createDerivedJobs() {
  const running = new Map<string, Promise<void>>();
  const done = new Set<string>();
  const failed = new Set<string>();
  return {
    run(key: string, make: () => Promise<void>): Promise<void> {
      const job = running.get(key);
      if (job) return job;
      const started = make().then(
        () => {
          done.add(key);
          running.delete(key);
        },
        (error: unknown) => {
          running.delete(key);
          throw error;
        },
      );
      running.set(key, started);
      return started;
    },
    isDone: (key: string) => done.has(key),
    /** Whether it's neither running nor known to fail, so it may start. */
    canStart: (key: string) => !running.has(key) && !failed.has(key),
    fail: (key: string) => failed.add(key),
  };
}

/** The derived files of this kernel: copies made from the files, such as reversed ones. */
export function createDerivedFiles(
  service: Pick<MediaService, "prepareReversed" | "reversedFileUrl">,
): Pick<MediaApi, "prepareReversed" | "reversedUrl"> {
  const jobs = createDerivedJobs();
  const reversedKey = (id: MediaId, full: boolean) => `reversed|${id}|${full ? "full" : "preview"}`;

  const prepareReversed: MediaApi["prepareReversed"] = (id, full, onProgress = () => {}) =>
    jobs.run(reversedKey(id, full), () => service.prepareReversed(id, full, onProgress));

  return {
    prepareReversed,
    reversedUrl(id, full) {
      const key = reversedKey(id, full);
      if (jobs.isDone(key)) return service.reversedFileUrl(id, full);
      if (jobs.canStart(key)) {
        notify("info", "Making a reversed copy of this clip. It shows once that's done.");
        prepareReversed(id, full).catch((error: unknown) => {
          jobs.fail(key);
          log.warn("No reversed copy", error);
          notify("error", `This clip can't play backwards: ${String(error)}`);
        });
      }
      return null;
    },
  };
}
