import { Folder } from "lucide-react";
import { useState } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { projectRef, type BinId } from "@/modules/project";
import { ContextMenu, cn } from "@/ui";
import { deleteBin, renameBin } from "../media.bin.commands";
import { mediaRef } from "../media.ref";
import { useBinDrop } from "./bin.drop.hook";
import { BinNameField } from "./BinNameField";

const BOX =
  "grid aspect-video place-items-center bg-muted shadow-[0_0_0_1px_var(--border-strong)] group-hover:shadow-[0_0_0_1.5px_var(--ring)]";

/** A bin inside the open one: a double click opens it, and it takes dropped files. */
export function BinTile({ id, name, list }: { id: BinId; name: string; list: boolean }) {
  const { bus } = useKernel();
  const { view } = useModule(mediaRef);
  const drop = useBinDrop(id);
  const [renaming, setRenaming] = useState(false);
  const count = useStore(useModule(projectRef).store.api, (s) => {
    const held = [...Object.values(s.media), ...Object.values(s.solids)];
    return (
      held.filter((item) => item.binId === id).length +
      Object.values(s.bins).filter((bin) => bin.parentId === id).length
    );
  });
  const open = () => view.setState({ place: { kind: "bin", binId: id }, selection: [] });
  const finish = (next: string | null) => {
    setRenaming(false);
    if (next) void bus.run(renameBin, { binId: id, name: next });
  };
  return (
    <ContextMenu
      items={[
        { label: "Open", onSelect: open },
        { label: "Rename", onSelect: () => setRenaming(true) },
        {
          label: "Delete bin",
          destructive: true,
          onSelect: () => void bus.run(deleteBin, { binId: id }),
        },
      ]}
    >
      <div
        ref={drop}
        title={`${name}: ${count} ${count === 1 ? "item" : "items"}`}
        className={cn("group cursor-pointer", list && "flex items-center gap-3 py-1")}
        onDoubleClick={open}
      >
        <div className={cn(BOX, list && "w-[72px] shrink-0")}>
          <Folder
            aria-hidden
            className={cn("text-subtle-foreground", list ? "size-5" : "size-9")}
          />
        </div>
        {renaming ? (
          <BinNameField initial={name} onDone={finish} />
        ) : (
          <p className={cn("truncate text-sm text-muted-foreground", !list && "mt-1")}>{name}</p>
        )}
      </div>
    </ContextMenu>
  );
}

/** Where a new bin gets its name, among the tiles. */
export function NewBinTile({ onDone }: { onDone(name: string | null): void }) {
  return (
    <div>
      <div className={BOX}>
        <Folder aria-hidden className="size-9 text-subtle-foreground" />
      </div>
      <BinNameField initial="" onDone={onDone} />
    </div>
  );
}
