import type { PictureFilter } from "@/modules/preview";
import { canGrade, gradeOf } from "@/modules/project";
import { gradePasses } from "./render/passes";
import type { TintLive } from "./tint.types";

/** Id of the picture filter that draws clip grades. */
export const TINT_GRADE_FILTER = "tint.grade";

/**
 * Draws each graded clip's grade (`clip.grade` as keyed now) in the preview, captures and export.
 * Live values are laid over it in the live preview only (`target` `"preview"`): a capture or an
 * export draws the document as saved. One per kernel, since it reads that kernel's live values.
 */
export function createTintFilter(live: TintLive): PictureFilter {
  return {
    id: TINT_GRADE_FILTER,
    order: 100,
    applies: (clip, project) => gradeOf(clip) !== null && canGrade(clip, project),
    passes({ clip, target }) {
      const grade = gradeOf(clip);
      if (!grade) return [];
      return gradePasses(grade, target === "preview" ? live.get(clip.id) : undefined);
    },
  };
}
