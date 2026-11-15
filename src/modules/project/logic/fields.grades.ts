import type { Draft } from "immer";
import type { ClipGrade, ProjectState } from "../project.types";
import { BUILTIN_LUT_PREFIX } from "./grade";
import { validateGrade } from "./grade.validate";

/**
 * A deleted shot group or LUT is no longer used: the clips and nodes that named it let go. A shot
 * group no clip is in any more goes too (with its grade), in the same step that took its last clip.
 */
export function dropDeletedGrades(draft: Draft<ProjectState>): void {
  const groups = draft.gradeGroups ?? {};
  const unknownLut = (id: string) => !id.startsWith(BUILTIN_LUT_PREFIX) && !draft.luts?.[id];
  const prune = (grade: ClipGrade | undefined) => {
    for (const node of Object.values(grade?.nodes ?? {})) {
      if (node.kind === "correct" && node.lut && unknownLut(node.lut.id)) delete node.lut;
    }
  };
  for (const clip of Object.values(draft.clips)) {
    if (clip.gradeGroup !== undefined && !groups[clip.gradeGroup]) delete clip.gradeGroup;
    prune(clip.grade);
    for (const version of Object.values(clip.gradeVersions ?? {})) prune(version.grade);
  }
  for (const composition of Object.values(draft.compositions)) prune(composition.grade);
  const used = new Set(Object.values(draft.clips).map((clip) => clip.gradeGroup));
  for (const id of Object.keys(groups)) if (!used.has(id)) delete groups[id];
  if (draft.gradeGroups && Object.keys(draft.gradeGroups).length === 0) delete draft.gradeGroups;
  for (const group of Object.values(draft.gradeGroups ?? {})) prune(group.grade);
  for (const still of Object.values(draft.stills ?? {})) prune(still.grade);
}

/** Every grade in the document, with where it is. */
function* gradesOf(state: ProjectState): Generator<[string, ClipGrade]> {
  for (const clip of Object.values(state.clips)) {
    if (clip.grade) yield [`clip ${clip.id}`, clip.grade];
    for (const [name, version] of Object.entries(clip.gradeVersions ?? {})) {
      if (version.grade) yield [`clip ${clip.id} version ${name}`, version.grade];
    }
  }
  for (const composition of Object.values(state.compositions)) {
    if (composition.grade) yield [`composition ${composition.id}`, composition.grade];
  }
  for (const group of Object.values(state.gradeGroups ?? {})) {
    if (group.grade) yield [`group ${group.id}`, group.grade];
  }
  for (const still of Object.values(state.stills ?? {})) {
    if (still.grade) yield [`still ${still.id}`, still.grade];
  }
}

/** The first grade in the document that is broken, as a message, or null. */
export function gradeProblem(state: ProjectState): string | null {
  for (const [where, grade] of gradesOf(state)) {
    const problem = validateGrade(grade);
    if (problem) return `the grade of ${where} would be broken: ${problem}`;
  }
  return null;
}
