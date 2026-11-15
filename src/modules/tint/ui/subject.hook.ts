import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { gradeOf, projectRef, useOpenComposition } from "@/modules/project";
import { useCurrentEntry } from "./current.hook";
import type { GradeSubject } from "./ui.types";
import { useTintView } from "./view.hook";

/**
 * The grade the page edits at the level the switch shows: the current clip's own, its shot
 * group's (null when the clip is in none) or the open composition's whole-timeline one. Null
 * without a current clip.
 */
export function useGradeSubject(): GradeSubject | null {
  const entry = useCurrentEntry();
  const level = useTintView((v) => v.level);
  const { store } = useModule(projectRef);
  const groupId = entry?.clip.gradeGroup;
  const group = useStore(store.api, (s) => (groupId ? s.gradeGroups?.[groupId] : undefined));
  const composition = useOpenComposition();
  const clip = entry?.clip;
  return useMemo(() => {
    if (!clip) return null;
    if (level === "clip") {
      return {
        level,
        target: { clipId: clip.id },
        id: clip.id,
        clipId: clip.id,
        grade: gradeOf(clip),
      };
    }
    if (level === "group") {
      if (!group) return null;
      const { id, grade } = group;
      return { level, target: { groupId: id }, id, clipId: clip.id, grade: grade ?? null };
    }
    if (!composition) return null;
    const { id, grade } = composition;
    return { level, target: { compositionId: id }, id, clipId: clip.id, grade: grade ?? null };
  }, [level, clip, group, composition]);
}
