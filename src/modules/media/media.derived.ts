import { createStore } from "zustand/vanilla";
import { createLogger, notify, toAppError } from "@/core";
import type { MediaId } from "@/modules/project";
import { Superseded, createDerivedJobs, createSerialQueue } from "./media.jobs";
import type {
  DenoiseJob,
  DenoiseJobs,
  DenoiseRequest,
  DenoiseSettings,
  DerivedFile,
  MediaApi,
  MediaService,
} from "./media.types";

const log = createLogger("media");

/**
 * The derived files of this kernel: copies made from the files, reversed or without noise. Each
 * is known by the file's revision too, so one relinked to another file gets its own.
 */
export function createDerivedFiles(
  service: Pick<MediaService, "prepareReversed" | "reversedFileUrl" | "denoise" | "derivedFileUrl">,
  revisionOf: (id: MediaId) => number | undefined,
): Pick<
  MediaApi,
  "prepareReversed" | "reversedUrl" | "denoised" | "denoisedUrl" | "wantDenoised" | "denoising"
> {
  const fileKey = (id: MediaId) => `${id}@${revisionOf(id) ?? 0}`;
  const reversed = createDerivedJobs<void>();
  const reversedKey = (id: MediaId, full: boolean) => `${fileKey(id)}|${full ? "full" : "preview"}`;

  const prepareReversed: MediaApi["prepareReversed"] = (id, full, onProgress = () => {}) =>
    reversed.run(reversedKey(id, full), () => service.prepareReversed(id, full, onProgress));

  const denoised = createDerivedJobs<DerivedFile>();
  const denoising = createStore<DenoiseJobs>(() => ({ jobs: [] }));
  const denoisedKey = (id: MediaId, { amountDb, floorDb }: DenoiseSettings, backwards: boolean) =>
    `${fileKey(id)}|${amountDb}|${floorDb}|${backwards ? "reversed" : "forward"}`;
  /** What the follower of the document wants now, and what was asked for outright (export). */
  let wanted = new Set<string>();
  const asked = new Set<string>();
  const queue = createSerialQueue((key) => wanted.has(key) || asked.has(key));

  /** Queues (or joins) a rendering, following its progress; a failure is told once. */
  const denoise = (request: DenoiseRequest): Promise<DerivedFile> => {
    const { mediaId, amountDb, floorDb, reversed: backwards } = request;
    const key = denoisedKey(mediaId, request, backwards);
    return denoised.run(key, () => {
      const mine = (j: DenoiseJob) =>
        j.mediaId === mediaId &&
        j.amountDb === amountDb &&
        j.floorDb === floorDb &&
        j.reversed === backwards;
      const others = () => denoising.getState().jobs.filter((j) => !mine(j));
      const report = (progress: number) =>
        denoising.setState({ jobs: [...others(), { ...request, progress }] });
      report(0);
      const rendering = queue(key, () => service.denoise(mediaId, request, report));
      rendering
        .catch((error: unknown) => {
          if (error instanceof Superseded) return;
          denoised.fail(key);
          log.warn("No denoised file", error);
          notify(
            "error",
            `The noise of this file can't be taken away: ${toAppError(error).message}`,
          );
        })
        .finally(() => {
          asked.delete(key);
          denoising.setState({ jobs: others() });
        });
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
          notify("error", `This clip can't play backwards: ${toAppError(error).message}`);
        });
      }
      return null;
    },
    denoised(id, settings) {
      const key = denoisedKey(id, settings, false);
      const file = denoised.madeBy(key);
      if (file) return file.path;
      asked.add(key);
      return denoise({ mediaId: id, ...settings, reversed: false }).then(({ path }) => path);
    },
    denoisedUrl(id, settings, backwards) {
      const file = denoised.madeBy(denoisedKey(id, settings, backwards));
      return file ? service.derivedFileUrl(id, file.name) : null;
    },
    wantDenoised(requests) {
      wanted = new Set(requests.map((r) => denoisedKey(r.mediaId, r, r.reversed)));
      for (const request of requests) {
        const key = denoisedKey(request.mediaId, request, request.reversed);
        if (!denoised.isMade(key) && denoised.canStart(key)) {
          void denoise(request).catch(() => undefined);
        }
      }
    },
    denoising,
  };
}
