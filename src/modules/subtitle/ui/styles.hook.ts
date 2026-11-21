import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, stylesOf, useOpenComposition } from "@/modules/project";

/** The open composition's id and its subtitle styles, in order (the first is the default). */
export function useStyles() {
  const project = useModule(projectRef).store;
  const id = useOpenComposition()?.id;
  const subtitleStyles = useStore(project.api, (s) => s.subtitleStyles);
  const compositions = useStore(project.api, (s) => s.compositions);
  const styles = useMemo(
    () => (id ? stylesOf({ ...project.getState(), subtitleStyles, compositions }, id) : []),
    [project, subtitleStyles, compositions, id],
  );
  return { compositionId: id, styles };
}
