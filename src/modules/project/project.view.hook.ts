import { useStore } from "zustand";
import { LOCAL_ACTOR, useModule } from "@/core";
import { projectRef } from "./project.ref";
import { DEFAULT_FORMAT } from "./project.store";
import type { Composition, ProjectFormat } from "./project.types";

/** The composition the user has open, or null. */
export function useOpenComposition(): Composition | null {
  const { store, view } = useModule(projectRef);
  const open = useStore(view.store, (s) => s.open[LOCAL_ACTOR]);
  return useStore(store.api, (s) => {
    const id = open === undefined ? s.mainCompositionId : open;
    return (id !== null && s.compositions[id]) || null;
  });
}

/** Format of the composition the user has open; the default when there is none. */
export function useOpenFormat(): ProjectFormat {
  return useOpenComposition()?.format ?? DEFAULT_FORMAT;
}
