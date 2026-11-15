import { useMemo } from "react";
import {
  DEFAULT_CORRECTION,
  correctionOf,
  type Correction,
  type CorrectionValues,
} from "@/modules/project";
import { itemOf, layerIds } from "../logic/layers";
import { numberOf, toStack } from "../logic/stack";
import { useGradeSubject } from "./subject.hook";
import type { EditTarget } from "./ui.types";
import { useTintView } from "./view.hook";

/**
 * The correction the tools edit in the grade of the current level (`useGradeSubject`): the
 * selected layer when it is a correction,
 * else the first correction inside the selected group, else the first correction of the stack,
 * else none (a clip not graded yet).
 */
export function useEditTarget(): EditTarget {
  const subject = useGradeSubject();
  const selected = useTintView((v) => v.selected);
  const grade = subject?.grade ?? null;
  return useMemo(() => {
    const isCorrection = (id: string | null | undefined): id is string =>
      id != null && grade?.nodes[id]?.kind === "correct";
    const stack = toStack(grade);
    const item = selected ? itemOf(stack, selected) : null;
    const group = item?.type === "group" ? item : null;
    const inside = group ? layerIds(group.branches.flat()) : [];
    const nodeId = isCorrection(selected)
      ? selected
      : (inside.find(isCorrection) ?? layerIds(stack).find(isCorrection) ?? null);
    const node = nodeId ? (grade?.nodes[nodeId] as Correction) : null;
    const values: CorrectionValues = node ? correctionOf(node) : DEFAULT_CORRECTION;
    const no = nodeId ? numberOf(grade)[nodeId] : undefined;
    return {
      subject,
      grade,
      nodeId,
      group: group ? { id: group.id, kind: group.kind } : null,
      values,
      title: node ? `${no ?? ""} ${node.name || "Correction"}`.trim() : null,
    };
  }, [subject, grade, selected]);
}
