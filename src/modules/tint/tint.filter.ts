import type { StoreApi } from "zustand";
import { CommandFailure, notify } from "@/core";
import type { MediaApi } from "@/modules/media";
import type { FilterTarget, PictureFilter } from "@/modules/preview";
import {
  BUILTIN_LUT_PREFIX,
  canGrade,
  gradeOf,
  type Clip,
  type ClipGrade,
  type ProjectState,
} from "@/modules/project";
import { gradePasses } from "./render/passes";
import { createGradeTextures } from "./render/textures";
import { videoRange } from "./tint.range";
import type { LutFiles, LutLookup, TintLive, TintView } from "./tint.types";

/** Id of the picture filter that draws clip grades. */
export const TINT_GRADE_FILTER = "tint.grade";

/** The capture option (`CaptureOptions.filters`) that draws a grade only up to a node (its id). */
export const TINT_CUT = "tint.cut";

/** The capture option that draws a whole `ClipGrade` in place of the clip's own, for look thumbnails. */
export const TINT_WITH = "tint.with";

/**
 * Draws each graded clip's grade (`clip.grade` as keyed now) in the preview, captures and export.
 * Live values are laid over it in the live preview only (`target` `"preview"`): a capture or an
 * export draws the document as saved. A capture that passes `TINT_CUT` (a node id) draws the grade only
 * up to that node, for layer thumbnails; one that passes `TINT_WITH` (a grade) draws that grade instead, even on a clip with none, for look thumbnails; both are that capture's alone. In the live preview only, the
 * correction in `view.showPicked` draws its key instead (Limit's Show). A camera input reads the
 * clip's file range from `media` (`videoRange`). A correction's LUT comes from `luts`: not `ready`
 * while its file is being read; a missing one is left out in the preview and captures (the preview
 * tells the user once per file), and fails an export with `tint.lut_missing`. One per kernel, since
 * it reads that kernel's live values and view.
 */
export function createTintFilter(
  live: TintLive,
  view: StoreApi<TintView>,
  media: Pick<MediaApi, "getProbe">,
  luts: LutFiles,
): PictureFilter {
  const textures = createGradeTextures();
  const warned = new Set<string>();
  const lutsOf = (clip: Clip, project: ProjectState) =>
    Object.values(gradeOf(clip)?.nodes ?? {}).flatMap((node) => {
      const id = node.kind === "correct" ? node.lut?.id : undefined;
      // A built-in look has no file to wait for.
      const lut = id && !id.startsWith(BUILTIN_LUT_PREFIX) ? project.luts?.[id] : undefined;
      return lut ? [lut] : [];
    });
  const lookup =
    (project: ProjectState, target: FilterTarget): LutLookup =>
    (id) => {
      const lut = id.startsWith(BUILTIN_LUT_PREFIX) ? undefined : project.luts?.[id];
      if (!lut) return null;
      const file = luts.file(lut);
      if (file.status === "ready") return file.lut;
      if (file.status === "missing") {
        if (target === "export") {
          throw new CommandFailure(
            "tint.lut_missing",
            `The LUT file ${lut.path} can't be read (${file.message}). Locate it first.`,
          );
        }
        if (target === "preview" && !warned.has(lut.path)) {
          warned.add(lut.path);
          notify("error", `The LUT ${lut.name} is missing, so it is left out: ${lut.path}`);
        }
      }
      return null;
    };
  return {
    id: TINT_GRADE_FILTER,
    order: 100,
    applies: (clip, project, options) =>
      (gradeOf(clip) !== null || options?.[TINT_WITH] !== undefined) && canGrade(clip, project),
    ready: (clip, project) =>
      lutsOf(clip, project).every((lut) => luts.file(lut).status !== "loading"),
    passes({ clip, project, target, options, size }) {
      const given = target === "capture" ? options?.[TINT_WITH] : undefined;
      const whole = (given as ClipGrade | undefined) ?? gradeOf(clip);
      if (!whole) return [];
      const cut = target === "capture" ? options?.[TINT_CUT] : undefined;
      const grade = typeof cut === "string" ? { ...whole, out: { node: cut } } : whole;
      const preview = target === "preview";
      const liveGrade = preview ? live.get(clip.id) : undefined;
      const show = preview ? view.getState().showPicked : null;
      return gradePasses(
        grade,
        liveGrade,
        textures,
        size.width / Math.max(size.height, 1),
        show,
        videoRange(clip, project, media),
        lookup(project, target),
      );
    },
  };
}

/** Redraws the preview whenever `view.showPicked` changes. Returns the unsubscribe. */
export function redrawOnShow(view: StoreApi<TintView>, redraw: () => void): () => void {
  return view.subscribe((next, before) => {
    if (next.showPicked !== before.showPicked) redraw();
  });
}
