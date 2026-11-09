import type { PictureFilter } from "@/modules/preview";
import { canGrade, gradeOf } from "@/modules/project";
import { gradePasses } from "./render/passes";
import type { TintLive } from "./tint.types";

/** Id of the picture filter that draws clip grades. */
export const TINT_GRADE_FILTER = "tint.grade";

/** The capture option (`CaptureOptions.filters`) that draws a grade only up to a node (its id). */
export const TINT_CUT = "tint.cut";

/**
 * Draws each graded clip's grade (`clip.grade` as keyed now) in the preview, captures and export.
 * Live values are laid over it in the live preview only (`target` `"preview"`): a capture or an
 * export draws the document as saved. A capture that passes `TINT_CUT` (a node id) draws the grade only
 * up to that node, for layer thumbnails; it is that capture's alone. One per kernel, since it reads
 * that kernel's live values.
 */
export function createTintFilter(live: TintLive): PictureFilter {
  return {
    id: TINT_GRADE_FILTER,
    order: 100,
    applies: (clip, project) => gradeOf(clip) !== null && canGrade(clip, project),
    passes({ clip, target, options }) {
      const whole = gradeOf(clip);
      if (!whole) return [];
      const cut = target === "capture" ? options?.[TINT_CUT] : undefined;
      const grade = typeof cut === "string" ? { ...whole, out: { node: cut } } : whole;
      return gradePasses(grade, target === "preview" ? live.get(clip.id) : undefined);
    },
  };
}
