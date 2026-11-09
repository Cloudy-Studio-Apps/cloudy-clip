import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, useOpenComposition } from "@/modules/project";
import { stripClips } from "../logic/strip";
import type { StripClip } from "../tint.types";

/** The strip's clips for the composition the user has open (by start, tagged V1…). */
export function useStrip(): StripClip[] {
  const project = useModule(projectRef);
  const open = useOpenComposition();
  const state = useStore(project.store.api, (s) => s);
  return useMemo(() => (open ? stripClips(state, open.id) : []), [state, open]);
}
