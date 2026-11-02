import { createLogger, notify } from "@/core";
import type { MediaId } from "@/modules/project";
import type { MediaApi, MediaService } from "./media.types";

const log = createLogger("media");

/** What this kernel knows of the reversed copies, so asking twice never makes one twice. */
export function createReversedCopies(
  service: Pick<MediaService, "prepareReversed" | "reversedFileUrl">,
): Pick<MediaApi, "prepareReversed" | "reversedUrl"> {
  const jobs = new Map<string, Promise<void>>();
  const ready = new Set<string>();
  const failed = new Set<string>();
  const keyOf = (id: MediaId, full: boolean) => `${id}|${full ? "full" : "preview"}`;

  const prepare: MediaApi["prepareReversed"] = (id, full, onProgress = () => {}) => {
    const key = keyOf(id, full);
    const running = jobs.get(key);
    if (running) return running;
    const job = service.prepareReversed(id, full, onProgress).then(
      () => {
        ready.add(key);
        jobs.delete(key);
      },
      (error: unknown) => {
        jobs.delete(key);
        throw error;
      },
    );
    jobs.set(key, job);
    return job;
  };

  return {
    prepareReversed: prepare,
    reversedUrl(id, full) {
      const key = keyOf(id, full);
      if (ready.has(key)) return service.reversedFileUrl(id, full);
      if (!jobs.has(key) && !failed.has(key)) {
        prepare(id, full).catch((error: unknown) => {
          failed.add(key);
          log.warn("No reversed copy", error);
          notify("error", `This clip can't play backwards: ${String(error)}`);
        });
      }
      return null;
    },
  };
}
