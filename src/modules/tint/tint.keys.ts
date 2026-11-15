import type { KeyField, KeyTarget } from "@/modules/keyframe";
import {
  GRADE_RANGES,
  correctionOf,
  projectRef,
  type Clip,
  type Correction,
  type CorrectionValues,
} from "@/modules/project";
import { KEYABLE_VALUES, fieldLabel, leafAt, withLeaf } from "./logic/keyable";
import { numberOf } from "./logic/stack";
import { setCorrection } from "./tint.node.commands";

/** The correction `id` of a clip's own grade, or undefined. */
function correctionIn(clip: Pick<Clip, "grade">, id: string): Correction | undefined {
  const node = clip.grade && Object.hasOwn(clip.grade.nodes, id) ? clip.grade.nodes[id] : undefined;
  return node?.kind === "correct" ? node : undefined;
}

/**
 * Every keyable number of every correction of a clip's own grade (`KEYABLE_VALUES` under
 * `grade.nodes.<id>.values.`, and `grade.nodes.<id>.opacity`), labeled "<nn> <name> · <Field>".
 * Only a clip on a video track with a grade has any; shot group and timeline grades aren't keyed.
 * When the last key goes, `tint.setCorrection` makes the value static (a wheel or group written
 * whole with that one number changed).
 */
export const tintKeys: KeyTarget = {
  id: "tint.keys",
  fields(clip, track) {
    const grade = clip.grade;
    if (track.kind !== "video" || !grade) return [];
    const numbers = numberOf(grade);
    return Object.entries(grade.nodes).flatMap(([id, node]): KeyField[] => {
      if (node.kind !== "correct") return [];
      const head = `${numbers[id] ?? ""} ${node.name || "Correction"}`.trim();
      const opacity: KeyField = {
        path: `grade.nodes.${id}.opacity`,
        label: `${head} · Opacity`,
        blend: "number",
        shared: true,
        min: 0,
        max: 1,
        read: (at) => correctionIn(at, id)?.opacity ?? 1,
        commitStatic: (run, clipId, value) =>
          run.execute(setCorrection, {
            target: { clipId },
            nodeId: id,
            patch: { opacity: Number(value) },
          }),
      };
      const values = KEYABLE_VALUES.map((sub): KeyField => ({
        path: `grade.nodes.${id}.values.${sub}`,
        label: `${head} · ${fieldLabel(sub)}`,
        blend: "number",
        shared: true,
        min: GRADE_RANGES[sub]!.min,
        max: GRADE_RANGES[sub]!.max,
        read: (at) => {
          const found = correctionIn(at, id);
          return found ? (leafAt(correctionOf(found), sub) as number) : 0;
        },
        commitStatic(run, clipId, value) {
          const clip = run.require(projectRef).store.getState().clips[clipId];
          const found = clip && correctionIn(clip, id);
          const top = sub.split(".")[0] as keyof CorrectionValues;
          const stored = found ? correctionOf(found) : undefined;
          const patch = withLeaf(stored ? { [top]: stored[top] } : {}, sub, Number(value));
          return run.execute(setCorrection, {
            target: { clipId },
            nodeId: id,
            patch: { values: patch as Partial<CorrectionValues> },
          });
        },
      }));
      return [...values, opacity];
    });
  },
};
