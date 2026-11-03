import { createStore } from "zustand/vanilla";
import { createLogger, notify, toAppError } from "@/core";
import type { MediaId } from "@/modules/project";
import { Superseded, createDerivedJobs, createSerialQueue } from "./media.jobs";
import type {
  DenoiseFailure,
  DenoiseJobs,
  DenoiseRequest,
  DerivedFile,
  MediaApi,
  MediaService,
} from "./media.types";

const log = createLogger("media");

/** The forward rendering a reversed one is made from (and export mixes from). */
const forwardOf = (request: DenoiseRequest): DenoiseRequest => ({ ...request, reversed: false });

/**
 * Noise reduction's renderings of this kernel, one at a time, keyed by the file (`fileKey`, with
 * its revision), the settings and the direction. A rendering that's made deletes the file's
 * others nobody needs; one that fails is shown in `denoising` and tried again once it's wanted
 * after a change.
 */
export function createDenoisedFiles(
  service: Pick<MediaService, "denoise" | "dropDenoised" | "derivedFileUrl">,
  fileKey: (id: MediaId) => string,
): Pick<MediaApi, "denoised" | "denoisedUrl" | "wantDenoised" | "denoising"> {
  const files = createDerivedJobs<DerivedFile>();
  const denoising = createStore<DenoiseJobs>(() => ({ jobs: [], failed: [] }));
  const keyOf = ({ mediaId, amountDb, floorDb, reversed }: DenoiseRequest) =>
    `${fileKey(mediaId)}|${amountDb}|${floorDb}|${reversed ? "reversed" : "forward"}`;
  /** What the follower of the document wants now. */
  let wanted: readonly DenoiseRequest[] = [];
  let wantedKeys = new Set<string>();
  /** What was asked for outright (export), kept for the kernel: an export may still read it. */
  const asked = new Map<string, DenoiseRequest>();
  const queue = createSerialQueue((key) => wantedKeys.has(key) || asked.has(key));

  const setFailure = (key: string, failure?: DenoiseFailure) =>
    denoising.setState(({ failed }) => ({
      failed: [...failed.filter((f) => keyOf(f) !== key), ...(failure ? [failure] : [])],
    }));

  /** Deletes the renderings of `done`'s file that nothing needs: not wanted, asked, running or queued. */
  const dropUnneeded = (done: DenoiseRequest) => {
    const { mediaId } = done;
    const needed = [...wanted, ...asked.values(), ...denoising.getState().jobs, done]
      .filter((request) => request.mediaId === mediaId)
      .flatMap((request) => (request.reversed ? [request, forwardOf(request)] : [request]));
    const keep = new Set(needed.map(keyOf));
    const ofFile = `${fileKey(mediaId)}|`;
    service
      .dropDenoised(mediaId, needed)
      .then(() => files.forget((key) => key.startsWith(ofFile) && !keep.has(key)))
      .catch((error: unknown) => log.warn("Old renderings not deleted", error));
  };

  /** Queues (or joins) a rendering, following its progress; a failure is told once. */
  const denoise = (request: DenoiseRequest): Promise<DerivedFile> => {
    const key = keyOf(request);
    return files.run(key, () => {
      const others = () => denoising.getState().jobs.filter((job) => keyOf(job) !== key);
      const report = (progress: number) =>
        denoising.setState({ jobs: [...others(), { ...request, progress }] });
      report(0);
      const rendering = queue(key, () => service.denoise(request.mediaId, request, report)).then(
        ({ forward, reversed }) => {
          // Made on the way to the reversed copy, and what export mixes from.
          if (request.reversed) files.record(keyOf(forwardOf(request)), forward);
          return reversed ?? forward;
        },
      );
      rendering
        .then(
          () => {
            setFailure(key);
            dropUnneeded(request);
          },
          (error: unknown) => {
            if (error instanceof Superseded) return;
            files.fail(key);
            const { message } = toAppError(error);
            setFailure(key, { ...request, message });
            log.warn("No denoised file", error);
            notify("error", `The noise of this file can't be taken away: ${message}`);
          },
        )
        .finally(() => denoising.setState({ jobs: others() }));
      return rendering;
    });
  };

  return {
    denoised(id, { amountDb, floorDb }) {
      const request = { mediaId: id, amountDb, floorDb, reversed: false };
      const key = keyOf(request);
      asked.set(key, request);
      const file = files.madeBy(key);
      if (file) return file.path;
      return denoise(request).then(({ path }) => path);
    },
    denoisedUrl(id, { amountDb, floorDb }, reversed) {
      const file = files.madeBy(keyOf({ mediaId: id, amountDb, floorDb, reversed }));
      return file ? service.derivedFileUrl(id, file.name) : null;
    },
    wantDenoised(requests) {
      wanted = requests;
      wantedKeys = new Set(requests.map(keyOf));
      // A failure is tried again once its settings come back after a change.
      const { failed } = denoising.getState();
      const left = failed.filter((failure) => !wantedKeys.has(keyOf(failure)));
      if (left.length > 0) {
        for (const failure of left) files.retry(keyOf(failure));
        denoising.setState({ failed: failed.filter((f) => wantedKeys.has(keyOf(f))) });
      }
      for (const request of requests) {
        const key = keyOf(request);
        if (!files.isMade(key) && files.canStart(key)) void denoise(request).catch(() => undefined);
      }
    },
    denoising,
  };
}
