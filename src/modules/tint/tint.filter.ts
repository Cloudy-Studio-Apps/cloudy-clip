import type { PictureFilter } from "@/modules/preview";
import { canGrade, gradeOf } from "@/modules/project";
import { gradePasses } from "./render/passes";
import type { TintCuts, TintLive } from "./tint.types";

/** Id of the picture filter that draws clip grades. */
export const TINT_GRADE_FILTER = "tint.grade";

/**
 * Draws each graded clip's grade (`clip.grade` as keyed now) in the preview, captures and export.
 * Live values are laid over it in the live preview only (`target` `"preview"`): a capture or an
 * export draws the document as saved. A clip with a cut (`TintCuts`, set while a layer thumbnail is
 * captured) is drawn in a capture only up to that node. One per kernel, since it reads that
 * kernel's live values and cuts.
 */
export function createTintFilter(live: TintLive, cuts: TintCuts): PictureFilter {
  return {
    id: TINT_GRADE_FILTER,
    order: 100,
    applies: (clip, project) => gradeOf(clip) !== null && canGrade(clip, project),
    passes({ clip, target }) {
      const whole = gradeOf(clip);
      if (!whole) return [];
      const cut = target === "capture" ? cuts.get(clip.id) : undefined;
      const grade = cut ? { ...whole, out: { node: cut } } : whole;
      return gradePasses(grade, target === "preview" ? live.get(clip.id) : undefined);
    },
  };
}
