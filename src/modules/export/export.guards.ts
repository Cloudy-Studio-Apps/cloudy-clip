import { CommandFailure, type CommandContext } from "@/core";
import { mediaRef, type MediaApi } from "@/modules/media";
import { projectRef, type Composition } from "@/modules/project";
import { fileName, joinPath } from "./logic/presets";
import { usedMedia } from "./logic/sources";
import { uniquePath } from "./export.service";
import type { ExportJob, ExportRange, SoundFile } from "./export.types";

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

/**
 * The files sound is mixed from (for `mixdown`): under noise reduction, the rendered ones. Asking
 * starts a rendering that hasn't been; the names of files whose rendering isn't done yet are
 * kept in `pending`, for `checkDenoised`.
 */
export function denoisedFiles(media: Pick<MediaApi, "denoised">): {
  soundFile: SoundFile;
  pending: Set<string>;
} {
  const pending = new Set<string>();
  const soundFile: SoundFile = (asset, denoise) => {
    if (!denoise) return asset.path;
    const file = media.denoised(asset.id, denoise);
    if (typeof file === "string") return file;
    // The user hears about a failure from media; the export is refused below either way.
    file.catch(() => undefined);
    pending.add(asset.name);
    return asset.path;
  };
  return { soundFile, pending };
}

/** Refuses an export while the noise reduction of some of its files is still rendering. */
export function checkDenoised(pending: ReadonlySet<string>): void {
  if (pending.size === 0) return;
  throw new CommandFailure(
    "export.denoise_pending",
    `Noise reduction is still being rendered for ${[...pending].join(", ")}. Export again once it's done.`,
  );
}

/**
 * Where the files go, as `ifExists` says, keeping clear of what's queued: one per suffix (see
 * `fileSuffixes`), `<name><suffix>.<ext>` in `folder`. They are numbered together, so an export and
 * its stems always share a name: `<name> (2) - Mix.wav` beside `<name> (2) - Dialogue.wav`.
 */
export async function outputPaths(
  folder: string,
  name: string,
  suffixes: readonly string[],
  extension: string,
  ifExists: "number" | "replace" | "fail",
  queued: readonly ExportJob[],
): Promise<string[]> {
  const files = (n: number) =>
    suffixes.map((suffix) =>
      joinPath(folder, `${n === 1 ? name : `${name} (${n})`}${suffix}.${extension}`),
    );
  const busy = queued.filter((job) => job.status !== "cancelled" && job.status !== "failed");
  const taken = (paths: readonly string[]) =>
    busy.some((job) => paths.includes(job.path) || job.stems?.some((p) => paths.includes(p)));
  /** The first of `paths` that's already on disk. */
  const clash = async (paths: readonly string[]) => {
    const free = await Promise.all(paths.map(uniquePath));
    return paths.find((path, i) => free[i] !== path);
  };
  const wanted = files(1);
  if (ifExists === "fail") {
    const there = await clash(wanted);
    if (there !== undefined) {
      throw new CommandFailure("export.fileExists", `${fileName(there)} already exists`);
    }
  }
  if (ifExists === "replace" && !taken(wanted)) return wanted;
  for (let n = 1; ; n++) {
    const next = files(n);
    if (!taken(next) && (await clash(next)) === undefined) return next;
  }
}
