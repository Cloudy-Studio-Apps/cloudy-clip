import { Plus } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { Button } from "@/ui";
import { compositionRef } from "../composition.ref";
import { CompositionTile } from "./CompositionTile";

/** The Library's compositions, above the files. */
export function CompositionSection() {
  const api = useModule(compositionRef);
  const store = useModule(projectRef).store;
  const order = useStore(store.api, (s) => s.compositionOrder);
  const records = useStore(store.api, (s) => s.compositions);
  const compositions = useMemo(
    () => order.flatMap((id) => (records[id] ? [records[id]] : [])),
    [order, records],
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.04em] text-subtle-foreground">
          Compositions
          {order.length > 0 && (
            <span className="ml-1.5 font-normal normal-case">· {order.length}</span>
          )}
        </h2>
        <Button variant="secondary" size="sm" title="New composition" onClick={api.openNew}>
          <Plus />
          New
        </Button>
      </div>
      {compositions.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {compositions.map((composition) => (
            <CompositionTile key={composition.id} composition={composition} />
          ))}
        </div>
      )}
    </div>
  );
}
