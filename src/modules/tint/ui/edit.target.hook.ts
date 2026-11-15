import { useMemo } from "react";
import { useClipAtPlayhead } from "@/modules/inspector";
import {
  DEFAULT_CORRECTION,
  correctionOf,
  type Clip,
  type Correction,
  type CorrectionValues,
} from "@/modules/project";
import { itemOf, layerIds } from "../logic/layers";
import { numberOf, toStack } from "../logic/stack";
import { useCurrentEntry } from "./current.hook";
import { useGradeSubject } from "./subject.hook";
import type { EditTarget } from "./ui.types";
import { useTintView } from "./view.hook";

/** Stands in for the clip while there is none, so the hook order never changes. */
const NO_CLIP: Clip = {
  id: "",
  kind: "media",
  trackId: "",
  props: {},
  start: 0,
  sourceIn: 0,
  duration: 0,
};

/**
 * The correction the tools edit in the grade of the current level (`useGradeSubject`): the
 * selected layer when it is a correction,
 * else the first correction inside the selected group, else the first correction of the stack,
 * else none (a clip not graded yet). At the clip level, `values` are those at the playhead, keyed
 * ones as their keys make them.
 */
export function useEditTarget(): EditTarget {
  const subject = useGradeSubject();
  const selected = useTintView((v) => v.selected);
  const now = useClipAtPlayhead(useCurrentEntry()?.clip ?? NO_CLIP);
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
    const keyed = subject?.level === "clip" && nodeId ? now.grade?.nodes[nodeId] : undefined;
    const shown = keyed?.kind === "correct" ? keyed : node;
    const values: CorrectionValues = shown ? correctionOf(shown) : DEFAULT_CORRECTION;
    const no = nodeId ? numberOf(grade)[nodeId] : undefined;
    return {
      subject,
      grade,
      nodeId,
      group: group ? { id: group.id, kind: group.kind } : null,
      values,
      title: node ? `${no ?? ""} ${node.name || "Correction"}`.trim() : null,
    };
  }, [subject, grade, selected, now]);
}
