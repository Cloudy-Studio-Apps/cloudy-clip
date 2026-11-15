import { CommandFailure } from "@/core";
import {
  canGrade,
  gradeOf,
  minimizeGrade,
  validateGrade,
  type Clip,
  type ClipGrade,
  type GradeNodeId,
  type ProjectState,
} from "@/modules/project";
import { keyProblem } from "./logic/keys";
import type { GradeTarget } from "./tint.types";

/** The clip a target names, or null for a group or a composition. Throws when it is missing or can't be graded. */
function clipOf(state: ProjectState, target: GradeTarget): Clip | null {
  if (!("clipId" in target)) return null;
  const clip = state.clips[target.clipId];
  if (!clip) {
    throw new CommandFailure("tint.target_not_found", `No clip with id "${target.clipId}"`);
  }
  if (!canGrade(clip, state)) {
    throw new CommandFailure(
      "tint.not_gradeable",
      `Clip "${target.clipId}" can't be graded: only a video or image file, or a composition, on a video track has a picture to grade.`,
    );
  }
  return clip;
}

/** The grade a target holds, or null when it has none. Throws `tint.target_not_found` and `tint.not_gradeable`. */
export function readGrade(state: ProjectState, target: GradeTarget): ClipGrade | null {
  const clip = clipOf(state, target);
  if (clip) return gradeOf(clip);
  if ("groupId" in target) {
    const group = state.gradeGroups?.[target.groupId];
    if (!group) {
      throw new CommandFailure("tint.target_not_found", `No shot group "${target.groupId}"`);
    }
    return group.grade ?? null;
  }
  const compositionId = (target as { compositionId: string }).compositionId;
  const composition = state.compositions[compositionId];
  if (!composition) {
    throw new CommandFailure("tint.target_not_found", `No composition "${compositionId}"`);
  }
  return composition.grade ?? null;
}

/**
 * The grade ready to store: defaults dropped, graph rules checked. Undefined for a grade that is
 * just source to out. Throws `tint.invalid_grade`.
 */
export function checkedGrade(grade: ClipGrade): ClipGrade | undefined {
  const problem = validateGrade(grade);
  if (problem) throw new CommandFailure("tint.invalid_grade", problem);
  return minimizeGrade(grade);
}

/** Stores a grade on its target (undefined removes the field). The target was read before. */
export function writeGrade(
  draft: ProjectState,
  target: GradeTarget,
  grade: ClipGrade | undefined,
): void {
  const holder =
    "clipId" in target
      ? draft.clips[target.clipId]
      : "groupId" in target
        ? draft.gradeGroups?.[target.groupId]
        : draft.compositions[target.compositionId];
  if (!holder) return;
  if (grade) holder.grade = grade;
  else delete holder.grade;
}

/** Keys of a clip's `grade.*` tracks, for the clip a target names (none for a group or composition). */
function trackPaths(state: ProjectState, target: GradeTarget): string[] {
  const clip = "clipId" in target ? state.clips[target.clipId] : undefined;
  return Object.keys(clip?.animation ?? {}).filter((path) => path.startsWith("grade."));
}

/**
 * The fields of `fields` of a node whose value has keys on the clip: a static write to them is
 * refused. A field is a top-level value (`lift`, covering a track at `lift.x`), `opacity` or `on`.
 */
export function animatedFields(
  state: ProjectState,
  target: GradeTarget,
  nodeId: GradeNodeId,
  fields: readonly string[],
): string[] {
  const values = `grade.nodes.${nodeId}.values.`;
  const paths = trackPaths(state, target);
  return fields.filter((field) =>
    paths.some((path) =>
      field === "opacity" || field === "on"
        ? path === `grade.nodes.${nodeId}.${field}`
        : path === values + field || path.startsWith(`${values}${field}.`),
    ),
  );
}

/** Drops the clip's `grade.*` tracks for which `drop(path)` is true. A target that isn't a clip has none. */
export function dropTracks(
  draft: ProjectState,
  target: GradeTarget,
  drop: (path: string) => boolean,
): void {
  const clip = "clipId" in target ? draft.clips[target.clipId] : undefined;
  if (!clip?.animation) return;
  for (const path of Object.keys(clip.animation)) {
    if (path.startsWith("grade.") && drop(path)) delete clip.animation[path];
  }
  if (Object.keys(clip.animation).length === 0) delete clip.animation;
}

/**
 * Throws when correction `id` of `grade` takes its key (`limit.from`) from where it can't:
 * `tint.node_not_found` (no such node), `tint.key_not_limited` (not a key join, nor a correction whose limit
 * limits something), `tint.key_cycle` (the key's node reads this one, or is it) or
 * `tint.key_not_above` (this one doesn't read the key's node: a sibling branch).
 */
export function checkSharedKey(grade: ClipGrade, id: GradeNodeId): void {
  const node = grade.nodes[id];
  const from = node?.kind === "correct" ? node.limit?.from : undefined;
  if (from === undefined) return;
  const problem = keyProblem(grade, id, from);
  if (problem === "missing") {
    throw new CommandFailure("tint.node_not_found", `No node "${from}" to take a key from`, {
      nodeId: from,
    });
  }
  if (problem === "not_limited") {
    throw new CommandFailure(
      "tint.key_not_limited",
      `Node "${from}" is not a correction with a limit, so it has no pick to share.`,
      { nodeId: from },
    );
  }
  if (problem === "not_above") {
    throw new CommandFailure(
      "tint.key_not_above",
      `Node "${id}" can't use the pick of "${from}": a shared pick must come from a correction above it (one whose picture it reads).`,
      { nodeId: id, from },
    );
  }
  if (problem === "cycle") {
    throw new CommandFailure(
      "tint.key_cycle",
      `Node "${id}" can't use the pick of "${from}": that one is drawn from this one, so the key would read itself. Use the pick of a correction above it.`,
      { nodeId: id, from },
    );
  }
}
