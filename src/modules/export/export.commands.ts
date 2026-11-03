import { z } from "zod";
import { createId, CommandFailure, defineCommand } from "@/core";
import { mediaHasAudio, mediaRef } from "@/modules/media";
import { projectRef } from "@/modules/project";
import { estimateBytes } from "./logic/estimate";
import { NO_MIX, mixdown } from "./logic/mixdown";
import {
  DEFAULT_EFFORT,
  DEFAULT_IF_EXISTS,
  DEFAULT_QUALITY,
  EXPORT_KINDS,
  encoderValues,
  formatInfo,
  kindOf,
  validName,
} from "./logic/presets";
import { saveFolder } from "./export.store";
import { exportRef } from "./export.ref";
import { checkDenoised, checkSources, denoisedFiles, outputPath, rangeOf } from "./export.guards";
import { readCapabilities } from "./export.service";
import type { ExportJob } from "./export.types";

const FORMAT = z.enum(["h264", "h265", "webm", "prores", "gif", "mp3"]);
const EFFORT = z.enum(["fast", "balanced", "small"]);
const JOB_ID = z.object({ jobId: z.string().describe("The job's id, from export_enqueue") });

const ENQUEUE_INPUT = z.object({
  name: z.string().describe("File name without its extension"),
  folder: z.string().describe("Absolute path of the folder; made if it doesn't exist"),
  compositionId: z.string().optional().describe("Defaults to the composition you have open"),
  format: FORMAT.default("h264").describe(
    "h264 and h265 are MP4, webm is VP9, prores is MOV, gif has no sound, mp3 is sound only",
  ),
  quality: z.number().int().min(10).max(100).default(DEFAULT_QUALITY).describe("10 to 100"),
  effort: EFFORT.default(DEFAULT_EFFORT).describe("fast, balanced, or small (slow, smaller file)"),
  sound: z.boolean().default(true),
  hardware: z.boolean().default(false).describe("Use the graphics card when one works"),
  range: z
    .object({ start: z.number().int().min(0), duration: z.number().int().positive() })
    .optional()
    .describe("Part of the timeline in microseconds. Defaults to all of it"),
  ifExists: z
    .enum(["number", "replace", "fail"])
    .default(DEFAULT_IF_EXISTS)
    .describe("What to do when the file is already there"),
  reveal: z.boolean().default(false).describe("Show the file when it's done"),
});

/** Adds an export to the queue. The document is kept as it is now. */
export const enqueue = defineCommand({
  id: "export.enqueue",
  label: "Add to export queue",
  description:
    "Adds an export to the queue and returns its jobId. Size and frame rate come from the composition. Run the queue with export_start and watch it with export_get_queue. Later edits don't change a queued export. Fails with export.noFfmpeg, export.formatUnavailable, export.noComposition, export.emptyRange, export.noSound, export.missingMedia, export.mediaNotReady, export.denoise_pending (noise reduction of a file is still being rendered; it starts if it hadn't, so try again once it's done), export.badName or export.fileExists.",
  undoable: false,
  input: ENQUEUE_INPUT,
  async run(ctx, input) {
    const { store, view } = ctx.require(projectRef);
    const api = ctx.require(exportRef);
    const media = ctx.require(mediaRef);
    const capabilities = await readCapabilities();
    if (!capabilities.ffmpeg) {
      throw new CommandFailure("export.noFfmpeg", "Install FFmpeg to export videos.");
    }
    if (!capabilities.formats.includes(input.format)) {
      throw new CommandFailure(
        "export.formatUnavailable",
        "The FFmpeg on this computer can't write that format.",
      );
    }
    if (!validName(input.name)) {
      throw new CommandFailure("export.badName", "That can't be a file name.");
    }
    const project = store.getState();
    const id = input.compositionId ?? view.openFor(ctx.actor);
    const composition = id === null ? undefined : project.compositions[id];
    if (!composition) {
      throw new CommandFailure("export.noComposition", "There's no composition to export.");
    }
    const range = rangeOf(composition, input.range);
    checkSources(ctx, composition, range);

    const info = formatInfo(input.format);
    const hasSound = (mediaId: string) => mediaHasAudio(media.getProbe(mediaId));
    const { soundFile, pending } = denoisedFiles(media);
    const mixed =
      info.sound && input.sound
        ? mixdown(project, composition.id, range, hasSound, soundFile)
        : null;
    checkDenoised(pending);
    const sound = mixed?.segments ?? [];
    if (!info.picture && sound.length === 0) {
      throw new CommandFailure("export.noSound", "This part of the timeline has no sound.");
    }
    const { width, height, fps } = composition.format;
    const name = input.name.trim();
    const path = await outputPath(
      input.folder,
      name,
      info.extension,
      input.ifExists,
      api.queue.getState().jobs,
    );
    const file = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
    const job: ExportJob = {
      id: createId("export"),
      file,
      path,
      kindLabel: EXPORT_KINDS.find((kind) => kind.id === kindOf(input.quality))?.label ?? "Custom",
      compositionId: composition.id,
      status: "waiting",
      progress: 0,
      estimatedBytes: estimateBytes({
        format: composition.format,
        info,
        quality: input.quality,
        duration: range.duration,
        sound: sound.length > 0,
        effort: input.effort,
        hardware: input.hardware,
      }),
      reveal: input.reveal,
      range,
      project,
      spec: {
        output: path,
        format: input.format,
        width,
        height,
        fps,
        duration: range.duration,
        ...encoderValues(input.format, input.quality),
        effort: input.effort,
        hardware: input.hardware,
        sound,
        mix: mixed?.mix ?? NO_MIX,
      },
    };
    api.queue.setState(({ jobs }) => ({ jobs: [...jobs, job] }));
    saveFolder(input.folder);
    return { jobId: job.id, path, estimatedBytes: job.estimatedBytes };
  },
});

/** Runs what's waiting in the queue, in order. */
export const start = defineCommand({
  id: "export.start",
  label: "Export",
  description:
    "Starts the queue and returns at once: exports run one at a time in the background. Watch them with export_get_queue.",
  undoable: false,
  input: z.object({}),
  run(ctx) {
    const api = ctx.require(exportRef);
    api.runner.start();
    return { waiting: api.queue.getState().jobs.filter((job) => job.status === "waiting").length };
  },
});

/** Stops an export that is waiting or running. Nothing is left on disk. */
export const cancel = defineCommand({
  id: "export.cancel",
  label: "Cancel export",
  description: "Stops an export that is waiting or running. Its partial file is removed.",
  undoable: false,
  input: JOB_ID,
  async run(ctx, { jobId }) {
    const api = ctx.require(exportRef);
    const job = api.queue.getState().jobs.find((one) => one.id === jobId);
    if (!job) throw new CommandFailure("export.noJob", "That export isn't in the queue.");
    await api.runner.cancel(jobId);
  },
});

/** Takes an export that isn't running off the list. The file stays. */
export const remove = defineCommand({
  id: "export.remove",
  label: "Remove export",
  description:
    "Takes an export off the queue. A running one must be cancelled first. A finished file stays on disk.",
  undoable: false,
  input: JOB_ID,
  run(ctx, { jobId }) {
    const { queue } = ctx.require(exportRef);
    const job = queue.getState().jobs.find((one) => one.id === jobId);
    if (!job) throw new CommandFailure("export.noJob", "That export isn't in the queue.");
    if (["preparing", "rendering", "finishing"].includes(job.status)) {
      throw new CommandFailure("export.running", "Cancel this export first.");
    }
    queue.setState(({ jobs }) => ({ jobs: jobs.filter((one) => one.id !== jobId) }));
  },
});

/** Moves a waiting export one place earlier. */
export const moveUp = defineCommand({
  id: "export.moveUp",
  label: "Move export up",
  description: "Moves a waiting export one place earlier, ahead of the waiting one before it.",
  undoable: false,
  input: JOB_ID,
  run(ctx, { jobId }) {
    const { queue } = ctx.require(exportRef);
    const jobs = [...queue.getState().jobs];
    const index = jobs.findIndex((job) => job.id === jobId);
    const [before, job] = [jobs[index - 1], jobs[index]];
    if (!job || !before || job.status !== "waiting" || before.status !== "waiting") return;
    jobs[index - 1] = job;
    jobs[index] = before;
    queue.setState({ jobs });
  },
});

/** Clears what's over from the list. */
export const clearFinished = defineCommand({
  id: "export.clearFinished",
  label: "Clear finished exports",
  description: "Takes finished, failed and cancelled exports off the queue. Files stay on disk.",
  undoable: false,
  input: z.object({}),
  run(ctx) {
    const { queue } = ctx.require(exportRef);
    const over = ["done", "failed", "cancelled"];
    queue.setState(({ jobs }) => ({ jobs: jobs.filter((job) => !over.includes(job.status)) }));
  },
});

export const exportCommands = [enqueue, start, cancel, remove, moveUp, clearFinished];
