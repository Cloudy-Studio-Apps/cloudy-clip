import { Plus } from "lucide-react";
import { useState } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { projectRef, type Bin, type BinId } from "@/modules/project";
import { IconButton } from "@/ui";
import { createBin } from "../media.bin.commands";
import { mediaRef } from "../media.ref";
import { BinNameField } from "./BinNameField";
import { BinRow } from "./BinRow";
import { countAt, useLibrarySource } from "./library.rows.hook";

/** Master and the bins, each under its parent. */
export function BinTree() {
  const { bus } = useKernel();
  const { view } = useModule(mediaRef);
  const project = useModule(projectRef).store.api;
  const bins = useStore(project, (s) => s.bins);
  const binOrder = useStore(project, (s) => s.binOrder);
  const place = useStore(view, (s) => s.place);
  const source = useLibrarySource();
  const [adding, setAdding] = useState(false);

  const openBin = place.kind === "bin" ? place.binId : undefined;
  const row = (binId: BinId | null, label: string, depth: number) => (
    <BinRow
      key={binId ?? "master"}
      binId={binId}
      label={label}
      depth={depth}
      active={(openBin ?? undefined) === (binId ?? undefined) && place.kind === "bin"}
      count={countAt(source, { kind: "bin", binId })}
    />
  );
  const branch = (parentId: BinId | null, depth: number): React.ReactNode =>
    binOrder
      .flatMap((id): Bin[] => (bins[id]?.parentId === parentId ? [bins[id]] : []))
      .map((bin) => [row(bin.id, bin.name, depth), branch(bin.id, depth + 1)]);

  return (
    <section className="flex min-h-0 flex-1 flex-col border-b border-border-strong">
      <h2 className="flex h-8 shrink-0 items-center justify-between pl-3 pr-1.5 font-hand text-[13.5px] font-bold">
        Bins
        <IconButton
          label="New bin"
          className="size-6 [&_svg]:size-3.5"
          onClick={() => setAdding(true)}
        >
          <Plus />
        </IconButton>
      </h2>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-1.5">
        {row(null, "Master", 0)}
        {branch(null, 1)}
        {adding && (
          <BinNameField
            depth={1}
            initial=""
            onDone={(name) => {
              setAdding(false);
              if (name) void bus.run(createBin, { name, parentId: openBin ?? undefined });
            }}
          />
        )}
      </div>
    </section>
  );
}
