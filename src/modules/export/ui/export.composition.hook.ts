import { useMemo } from "react";
import { useStore } from "zustand";
import { LOCAL_ACTOR, useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { exportRef } from "../export.ref";
import { stemsOf } from "../logic/stems";

/**
 * The composition the Export page exports (the one chosen in the form, else the open one, else
 * the first), the compositions to choose from, and the stems it would get: every group, and
 * Other when some tracks send straight to Master. `groups` says whether it has a group at all,
 * which stems need.
 */
export function useExportComposition() {
  const api = useModule(exportRef);
  const project = useModule(projectRef);
  const compositionId = useStore(api.form, (state) => state.compositionId);
  const records = useStore(project.store.api, (state) => state.compositions);
  const tracks = useStore(project.store.api, (state) => state.tracks);
  const order = useStore(project.store.api, (state) => state.compositionOrder);
  const compositions = useMemo(
    () => order.flatMap((id) => (records[id] ? [records[id]] : [])),
    [order, records],
  );
  const open = useStore(project.view.store, () => project.view.openFor(LOCAL_ACTOR));
  const composition =
    (compositionId !== null ? records[compositionId] : undefined) ??
    (open !== null ? records[open] : undefined) ??
    compositions[0];
  const id = composition?.id;
  const stems = useMemo(
    () => (id ? stemsOf({ compositions: records, tracks }, id) : []),
    [id, records, tracks],
  );
  const groups = stems.some(({ bus }) => bus !== undefined);
  return { composition, compositions, stems, groups };
}
