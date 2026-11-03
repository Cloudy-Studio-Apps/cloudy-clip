import { createLogger, notify, toAppError } from "@/core";
import type { MediaId } from "@/modules/project";
import { createDenoisedFiles } from "./media.denoise";
import { createDerivedJobs } from "./media.jobs";
import type { MediaApi, MediaService } from "./media.types";

const log = createLogger("media");

/**
 * The derived files of this kernel: copies made from the files, reversed or without noise. Each
 * is known by the file's revision too, so one relinked to another file gets its own.
 */
export function createDerivedFiles(
  service: Pick<
    MediaService,
    "prepareReversed" | "reversedFileUrl" | "denoise" | "dropDenoised" | "derivedFileUrl"
  >,
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
    ...createDenoisedFiles(service, fileKey),
  };
}
