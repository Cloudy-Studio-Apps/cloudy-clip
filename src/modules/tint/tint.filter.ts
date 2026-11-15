import type { StoreApi } from "zustand";
import { CommandFailure, notify } from "@/core";
import type { MediaApi } from "@/modules/media";
import {
  chainPasses,
  type FilterInfo,
  type FilterTarget,
  type FrameFilter,
  type GpuPass,
  type PictureFilter,
} from "@/modules/preview";
import {
  BUILTIN_LUT_PREFIX,
  canGrade,
  gradeOf,
  type Clip,
  type ClipGrade,
  type Lut,
  type ProjectState,
} from "@/modules/project";
import { gradePasses } from "./render/passes";
import { createGradeTextures } from "./render/textures";
import { videoRange } from "./tint.range";
import type {
  GradeLevel,
  GradeTextures,
  LutFiles,
  LutLookup,
  TintCut,
  TintLive,
  TintView,
  TintWith,
} from "./tint.types";

/** Id of the picture filter that draws clip grades. */
export const TINT_GRADE_FILTER = "tint.grade";

/** Id of the frame filter that draws a composition's whole-timeline grade. */
export const TINT_TIMELINE_FILTER = "tint.timeline";

/** The capture option (`CaptureOptions.filters`) that draws the grades only up to a node (`TintCut`). */
export const TINT_CUT = "tint.cut";

/** The capture option that draws a grade in place of one level's (`TintWith`), for look thumbnails. */
export const TINT_WITH = "tint.with";

/**
 * `textures` with the curve and warper keys scoped by the grade's holder (clip, shot group or
 * composition id), so two grades sharing node ids (a pasted grade) keep a table each instead of
 * baking each other's away every frame. LUT keys stay per LUT: the table is the file's.
 */
function heldBy(textures: GradeTextures, holder: string): GradeTextures {
  return {
    curves: (values, key) => textures.curves(values, `${holder}:${key}`),
    warper: (warper, key) => textures.warper(warper, `${holder}:${key}`),
    lut: textures.lut,
  };
}

/** The grade of a clip's shot group, or null (no group, or one with no grade). */
function groupGrade(clip: Clip, project: ProjectState): ClipGrade | null {
  return clip.gradeGroup === undefined
    ? null
    : (project.gradeGroups?.[clip.gradeGroup]?.grade ?? null);
}

/** The LUT files a grade's corrections read (built-in looks have none to wait for). */
function lutsOf(grade: ClipGrade | null, project: ProjectState): Lut[] {
  return Object.values(grade?.nodes ?? {}).flatMap((node) => {
    const id = node.kind === "correct" ? node.lut?.id : undefined;
    const lut = id && !id.startsWith(BUILTIN_LUT_PREFIX) ? project.luts?.[id] : undefined;
    return lut ? [lut] : [];
  });
}

/**
 * The tint filters of one kernel, since they read that kernel's live values and view: `picture`
 * (`tint.grade`) draws each graded clip's own grade (`clip.grade` as keyed now), then its shot
 * group's grade, in the preview, captures and export; `frame` (`tint.timeline`) draws a
 * composition's whole-timeline grade on its composed frame, at the top and wherever it is placed.
 * A level with no grade adds no pass. Live values (by the id of the grade's holder) are laid over
 * the saved grades in the live preview only (`target` `"preview"`): a capture or an export draws
 * the document as saved. A capture's `TINT_CUT` (`TintCut`) draws the levels before it whole, the
 * one it names up to a node, and nothing after it, for layer thumbnails and pickers; `TINT_WITH`
 * (`TintWith`) draws a grade in place of one level's, even where there is none, for look
 * thumbnails. Both apply to the captured top-level clip (and the top-level frame) only, never
 * inside a placement, and are that capture's alone. In the live preview only, the correction in
 * `view.showPicked` draws its key instead, at the level `view.level` names, and the levels after
 * it are left out (Limit's Show; while Show is on below the timeline level, the timeline grade is left out). A camera input reads the clip's file range from `media`
 * (`videoRange`). A correction's LUT comes from `luts`: not `ready` while its file is being read; a
 * missing one is left out in the preview and captures (the preview tells the user once per file),
 * and fails an export with `tint.lut_missing`.
 */
export function createTintFilters(
  live: TintLive,
  view: StoreApi<TintView>,
  media: Pick<MediaApi, "getProbe">,
  luts: LutFiles,
): { picture: PictureFilter; frame: FrameFilter } {
  const textures = createGradeTextures();
  const warned = new Set<string>();
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
  const ready = (grades: (ClipGrade | null)[], project: ProjectState) =>
    grades.every((grade) =>
      lutsOf(grade, project).every((lut) => luts.file(lut).status !== "loading"),
    );
  /**
   * The passes of one level: `saved` (or the capture's `with` grade), cut by the capture's `cut`,
   * with live values and Show in the live preview. `stop` says the levels after it are left out.
   */
  const levelPasses = (
    level: GradeLevel,
    id: string,
    saved: ClipGrade | null,
    info: Omit<FilterInfo, "clip">,
    range: boolean,
    asked: { cut?: TintCut; with?: TintWith },
  ): { passes: GpuPass[]; stop: boolean } => {
    const { cut } = asked;
    const preview = info.target === "preview";
    const state = preview ? view.getState() : null;
    let grade = asked.with?.level === level ? asked.with.grade : saved;
    if (cut?.level === level) {
      grade = grade && cut.node !== null ? { ...grade, out: { node: cut.node } } : null;
    }
    const show = state?.level === level ? state.showPicked : null;
    const showing = show != null && grade?.nodes[show]?.kind === "correct";
    const passes = grade
      ? gradePasses(
          grade,
          preview ? live.get(id) : undefined,
          heldBy(textures, id),
          info.size.width / Math.max(info.size.height, 1),
          showing ? show : null,
          range,
          lookup(info.project, info.target),
        )
      : [];
    return { passes, stop: cut?.level === level || showing };
  };
  /** What a capture asked, when it is about this picture (`top`): never inside a placement. */
  const askedOf = (info: Pick<FilterInfo, "target" | "options">, top: boolean) =>
    info.target === "capture" && top
      ? {
          cut: info.options?.[TINT_CUT] as TintCut | undefined,
          with: info.options?.[TINT_WITH] as TintWith | undefined,
        }
      : {};
  const asks = (options: Readonly<Record<string, unknown>> | undefined, level: GradeLevel) =>
    (options?.[TINT_WITH] as TintWith | undefined)?.level === level;
  const picture: PictureFilter = {
    id: TINT_GRADE_FILTER,
    order: 100,
    applies: (clip, project, options) =>
      (gradeOf(clip) !== null ||
        groupGrade(clip, project) !== null ||
        asks(options, "clip") ||
        asks(options, "group")) &&
      canGrade(clip, project),
    ready: (clip, project) => ready([gradeOf(clip), groupGrade(clip, project)], project),
    passes(info) {
      const { clip, project } = info;
      const asked = askedOf(info, info.path === clip.id);
      const range = videoRange(clip, project, media);
      const own = levelPasses("clip", clip.id, gradeOf(clip), info, range, asked);
      if (own.stop) return own.passes;
      const group = levelPasses(
        "group",
        clip.gradeGroup ?? "",
        groupGrade(clip, project),
        info,
        range,
        asked,
      );
      return chainPasses([own.passes, group.passes]);
    },
  };
  const frame: FrameFilter = {
    id: TINT_TIMELINE_FILTER,
    order: 100,
    applies: (composition, _project, options) =>
      composition.grade !== undefined || asks(options, "timeline"),
    ready: (composition, project) => ready([composition.grade ?? null], project),
    passes(info) {
      const asked = askedOf(info, info.path === "");
      // A capture cut at the clip or its group stops before the whole-timeline grade, and so does
      // Show at either of them in the live preview.
      if (asked.cut && asked.cut.level !== "timeline") return [];
      const state = info.target === "preview" ? view.getState() : null;
      if (state && state.showPicked !== null && state.level !== "timeline") return [];
      const { composition } = info;
      return levelPasses("timeline", composition.id, composition.grade ?? null, info, false, asked)
        .passes;
    },
  };
  return { picture, frame };
}

/** Redraws the preview whenever `view.showPicked` or `view.level` (where Show applies) changes. Returns the unsubscribe. */
export function redrawOnShow(view: StoreApi<TintView>, redraw: () => void): () => void {
  return view.subscribe((next, before) => {
    if (next.showPicked !== before.showPicked || next.level !== before.level) redraw();
  });
}
