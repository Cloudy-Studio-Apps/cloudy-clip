import { useMemo } from "react";
import {
  DEFAULT_CORRECTION,
  correctionOf,
  gradeOf,
  type Correction,
  type CorrectionValues,
} from "@/modules/project";
import { itemOf, layerIds } from "../logic/layers";
import { numberOf, toStack } from "../logic/stack";
import { useCurrentEntry } from "./current.hook";
import type { EditTarget } from "./ui.types";
import { useTintView } from "./view.hook";

/**
 * The correction the tools edit on the current clip: the selected layer when it is a correction,
 * else the first correction inside the selected group, else the first correction of the stack,
 * else none (a clip not graded yet).
 */
export function useEditTarget(): EditTarget {
  const entry = useCurrentEntry();
  const selected = useTintView((v) => v.selected);
  const clip = entry?.clip;
  const grade = clip ? gradeOf(clip) : null;
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
      clipId: clip?.id ?? null,
      grade,
      nodeId,
      group: group ? { id: group.id, kind: group.kind } : null,
      values,
      title: node ? `${no ?? ""} ${node.name || "Correction"}`.trim() : null,
    };
  }, [clip?.id, grade, selected]);
}
