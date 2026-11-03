import { createStore } from "zustand/vanilla";
import { createLogger, notify, toAppError } from "@/core";
import type { MediaId } from "@/modules/project";
import type {
  DenoiseJob,
  DenoiseJobs,
  DenoiseSettings,
  DerivedFile,
  MediaApi,
  MediaService,
} from "./media.types";

const log = createLogger("media");

/**
 * The jobs making one kind of derived file in this kernel, by key: asking again while one runs
 * joins it, and what's made is remembered, so a file is never made twice.
 */
function createDerivedJobs<T>() {
  const running = new Map<string, Promise<T>>();
  const made = new Map<string, T>();
  const failed = new Set<string>();
  return {
    run(key: string, make: () => Promise<T>): Promise<T> {
      const job = running.get(key);
      if (job) return job;
      const started = make().then(
        (result) => {
          made.set(key, result);
          running.delete(key);
          return result;
        },
        (error: unknown) => {
          running.delete(key);
          throw error;
        },
      );
      running.set(key, started);
      return started;
    },
    /** What a finished job made; undefined while it runs or before. */
    madeBy: (key: string) => made.get(key),
    isMade: (key: string) => made.has(key),
    /** Whether it's neither running nor known to fail, so it may start. */
    canStart: (key: string) => !running.has(key) && !failed.has(key),
    fail: (key: string) => failed.add(key),
  };
}

/**
 * The derived files of this kernel: copies made from the files, reversed or without noise. Each
 * is known by the file's revision too, so one relinked to another file gets its own.
 */
export function createDerivedFiles(
  service: Pick<MediaService, "prepareReversed" | "reversedFileUrl" | "denoise" | "derivedFileUrl">,
  revisionOf: (id: MediaId) => number | undefined,
): Pick<MediaApi, "prepareReversed" | "reversedUrl" | "denoised" | "denoisedUrl" | "denoising"> {
  const fileKey = (id: MediaId) => `${id}@${revisionOf(id) ?? 0}`;
  const reversed = createDerivedJobs<void>();
  const reversedKey = (id: MediaId, full: boolean) => `${fileKey(id)}|${full ? "full" : "preview"}`;

  const prepareReversed: MediaApi["prepareReversed"] = (id, full, onProgress = () => {}) =>
    reversed.run(reversedKey(id, full), () => service.prepareReversed(id, full, onProgress));

  const denoised = createDerivedJobs<DerivedFile>();
  const denoising = createStore<DenoiseJobs>(() => ({ jobs: [] }));
  const denoisedKey = (id: MediaId, { amountDb, floorDb }: DenoiseSettings) =>
    `${fileKey(id)}|${amountDb}|${floorDb}`;

  /** Starts (or joins) a rendering, following its progress; a failure is told once. */
  const denoise = (mediaId: MediaId, settings: DenoiseSettings): Promise<DerivedFile> => {
    const key = denoisedKey(mediaId, settings);
    const { amountDb, floorDb } = settings;
    return denoised.run(key, () => {
      const job = { mediaId, amountDb, floorDb };
      const mine = (j: DenoiseJob) =>
        j.mediaId === mediaId && j.amountDb === amountDb && j.floorDb === floorDb;
      const others = () => denoising.getState().jobs.filter((j) => !mine(j));
      const report = (progress: number) =>
        denoising.setState({ jobs: [...others(), { ...job, progress }] });
      report(0);
      const rendering = service.denoise(mediaId, { amountDb, floorDb }, report);
      rendering
        .catch((error: unknown) => {
          denoised.fail(key);
          log.warn("No denoised file", error);
          notify(
            "error",
            `The noise of this file can't be taken away: ${toAppError(error).message}`,
          );
        })
        .finally(() => denoising.setState({ jobs: others() }));
      return rendering;
    });
  };

  return {
    prepareReversed,
    reversedUrl(id, full) {
      const key = reversedKey(id, full);
      if (reversed.isMade(key)) return service.reversedFileUrl(id, full);
      if (reversed.canStart(key)) {
        notify("info", "Making a reversed copy of this clip. It shows once that's done.");
        prepareReversed(id, full).catch((error: unknown) => {
          reversed.fail(key);
          log.warn("No reversed copy", error);
          notify("error", `This clip can't play backwards: ${String(error)}`);
        });
      }
      return null;
    },
    denoised(id, settings) {
      const file = denoised.madeBy(denoisedKey(id, settings));
      return file ? file.path : denoise(id, settings).then(({ path }) => path);
    },
    denoisedUrl(id, settings) {
      const key = denoisedKey(id, settings);
      const file = denoised.madeBy(key);
      if (file) return service.derivedFileUrl(id, file.name);
      if (denoised.canStart(key)) void denoise(id, settings).catch(() => undefined);
      return null;
    },
    denoising,
  };
}
