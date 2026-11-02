import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, type Solid } from "@/modules/project";

/** The library's solids, in order. */
export function useSolidEntries(): readonly Solid[] {
  const project = useModule(projectRef).store.api;
  const order = useStore(project, (s) => s.solidOrder);
  const solids = useStore(project, (s) => s.solids);
  return useMemo(() => order.flatMap((id) => solids[id] ?? []), [order, solids]);
}
