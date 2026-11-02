import { CommandFailure, type CommandContext } from "@/core";
import { mediaRef } from "@/modules/media";
import { projectRef, type Composition } from "@/modules/project";
import { joinPath, numberedName } from "./logic/presets";
import { usedMedia } from "./logic/sources";
import { uniquePath } from "./export.service";
import type { ExportJob, ExportRange } from "./export.types";

/** The stretch to export, or why it can't be. */
export function rangeOf(composition: Composition, range: ExportRange | undefined): ExportRange {
  const wanted = range ?? { start: 0, duration: composition.duration };
  const end = Math.min(wanted.start + wanted.duration, composition.duration);
  if (end <= wanted.start) {
    throw new CommandFailure("export.emptyRange", "There's nothing to export in that part");
  }
  return { start: wanted.start, duration: end - wanted.start };
}

/** Refuses files that are gone or still being converted. */
export function checkSources(
  ctx: CommandContext,
  composition: Composition,
  range: ExportRange,
): void {
  const { store } = ctx.require(projectRef);
  const media = ctx.require(mediaRef);
  const project = store.getState();
  for (const id of usedMedia(project, composition.id, range)) {
    const name = project.media[id]?.name ?? id;
    const probe = media.getProbe(id);
    if (!project.media[id] || probe?.status === "missing") {
      throw new CommandFailure("export.missingMedia", `${name} can't be found. Locate it first.`);
    }
    if (probe?.proxy && ["analyzing", "queued", "encoding"].includes(probe.proxy.state)) {
      throw new CommandFailure("export.mediaNotReady", `${name} is still being prepared.`);
    }
  }
}

/** Where the file goes, as `ifExists` says, keeping clear of what's queued. */
export async function outputPath(
  folder: string,
  name: string,
  extension: string,
  ifExists: "number" | "replace" | "fail",
  queued: readonly ExportJob[],
): Promise<string> {
  const wanted = joinPath(folder, `${name}.${extension}`);
  const taken = (path: string) =>
    queued.some(
      (job) => job.path === path && job.status !== "cancelled" && job.status !== "failed",
    );
  const free = await uniquePath(wanted);
  if (ifExists === "fail" && free !== wanted) {
    throw new CommandFailure("export.fileExists", `${name}.${extension} already exists`);
  }
  if (ifExists === "replace" && !taken(wanted)) return wanted;
  if (!taken(free)) return free;
  for (let n = 2; ; n++) {
    const next = await uniquePath(joinPath(folder, numberedName(name, extension, n)));
    if (!taken(next)) return next;
  }
}
