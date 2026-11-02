import { notify } from "@/core";
import type { VideoLevels } from "@/modules/preview";
import { usedMedia } from "./logic/sources";
import { frameCount, frameTime } from "./logic/timing";
import { formatInfo } from "./logic/presets";
import {
  beginExport,
  cancelExport,
  finishExport,
  levelsClip,
  revealFile,
  sendFrame,
} from "./export.service";
import type { ExportJob, ExportRunner, ExportStatus, RunnerDeps } from "./export.types";

/** A webview this close to black 0 and white 255 draws video as it should. */
const LEVELS_TOLERANCE = 6;

/** Thrown out of a job that was cancelled. */
class Cancelled extends Error {}

/** Runs the queue, one export at a time, outside the bus: an export takes minutes. */
export function createExportRunner({ queue, preview, media, log }: RunnerDeps): ExportRunner {
  let running = false;
  let disposed = false;
  /** The job at work and its FFmpeg. */
  let active: { id: string; nativeId: string | null } | null = null;
  let levels: Promise<VideoLevels | null> | null = null;

  // A cancelled job stays cancelled, whatever was under way when it happened.
  const update = (id: string, patch: Partial<ExportJob>) =>
    queue.setState(({ jobs }) => ({
      jobs: jobs.map((job) =>
        job.id === id && job.status !== "cancelled" ? { ...job, ...patch } : job,
      ),
    }));
  const jobOf = (id: string) => queue.getState().jobs.find((job) => job.id === id);
  const stopped = (id: string) => disposed || jobOf(id)?.status === "cancelled";
  const enter = (id: string, status: ExportStatus, message?: string) =>
    update(id, { status, progress: 0, message });

  /** How this webview draws video: measured once, null when it needs no correcting. */
  async function videoLevels(): Promise<VideoLevels | null> {
    levels ??= levelsClip()
      .then((id) => preview.measureVideoLevels(media.masterUrl(id)))
      .then(({ black, white }) => {
        log.info(`Video draws from ${black} to ${white}`);
        // A frame that wasn't decoded reads as nonsense, which would wreck every video layer.
        if (black > 64 || white < 192) throw new Error(`Unlikely levels: ${black} to ${white}`);
        return black <= LEVELS_TOLERANCE && white >= 255 - LEVELS_TOLERANCE
          ? null
          : { black, white };
      })
      .catch((error: unknown) => {
        log.warn("Could not measure video levels", error);
        notify("info", "Colors of this export may look a little flat.");
        levels = null;
        return null;
      });
    return levels;
  }

  /** A file that plays through a proxy gets its full-size copy first. */
  async function prepareSources(job: ExportJob): Promise<void> {
    const videos = [...usedMedia(job.project, job.compositionId, job.range)].filter(
      (id) => job.project.media[id]?.kind === "video",
    );
    const proxied = videos.filter((id) => media.getProbe(id)?.proxy?.state === "ready");
    if (!formatInfo(job.spec.format).picture || proxied.length === 0) return;
    enter(job.id, "preparing", "Preparing full-size copies");
    for (const [index, id] of proxied.entries()) {
      await media.prepareMaster(id, (progress) =>
        update(job.id, { progress: (index + progress) / proxied.length }),
      );
      if (stopped(job.id)) throw new Cancelled();
    }
  }

  async function renderFrames(job: ExportJob, frameUrl: string): Promise<void> {
    const { fps } = job.spec;
    const total = frameCount(job.range, fps);
    const corrected = await videoLevels();
    const renderer = preview.createRenderer({
      project: job.project,
      compositionId: job.compositionId,
      mediaUrl: media.masterUrl,
      ...(corrected && { videoLevels: corrected }),
    });
    try {
      for (let n = 0; n < total; n++) {
        if (stopped(job.id)) throw new Cancelled();
        const pixels = await renderer.frameAt(frameTime(job.range, fps, n));
        await sendFrame(frameUrl, pixels);
        update(job.id, { progress: (n + 1) / total });
      }
    } finally {
      renderer.dispose();
    }
  }

  async function run(job: ExportJob): Promise<void> {
    active = { id: job.id, nativeId: null };
    try {
      await prepareSources(job);
      if (stopped(job.id)) throw new Cancelled();
      const { jobId, frameUrl } = await beginExport(job.spec);
      active.nativeId = jobId;
      if (stopped(job.id)) throw new Cancelled();
      if (formatInfo(job.spec.format).picture) {
        enter(job.id, "rendering");
        await renderFrames(job, frameUrl);
      }
      if (stopped(job.id)) throw new Cancelled();
      enter(job.id, "finishing");
      const path = await finishExport(jobId);
      active.nativeId = null;
      update(job.id, { status: "done", progress: 1, path, message: undefined });
      notify("info", `${job.file} is ready`);
      if (job.reveal) await revealFile(path).catch((error) => log.warn("Reveal failed", error));
    } catch (error) {
      if (active.nativeId) await cancelExport(active.nativeId).catch(() => undefined);
      if (error instanceof Cancelled || stopped(job.id)) {
        update(job.id, { status: "cancelled", message: undefined });
        return;
      }
      const message = error instanceof Error ? error.message : describe(error);
      log.error(`Export of ${job.file} failed`, error);
      update(job.id, { status: "failed", message });
      notify("error", `${job.file} failed: ${message}`);
    } finally {
      active = null;
    }
  }

  async function drain(): Promise<void> {
    if (running) return;
    running = true;
    for (;;) {
      const next = queue.getState().jobs.find((job) => job.status === "waiting");
      if (!next || disposed) break;
      await run(next);
    }
    running = false;
  }

  return {
    start() {
      void drain();
    },
    async cancel(id) {
      update(id, { status: "cancelled", message: undefined });
      if (active?.id === id && active.nativeId) await cancelExport(active.nativeId);
    },
    dispose() {
      disposed = true;
      if (active?.nativeId) void cancelExport(active.nativeId);
    },
  };
}

/** A native error's message. */
function describe(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }
  return String(error);
}
