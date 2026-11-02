import { Folder } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useKernel, useModule } from "@/core";
import type { BinId } from "@/modules/project";
import { ContextMenu } from "@/ui";
import { deleteBin, moveToBin, renameBin } from "../media.bin.commands";
import { MEDIA_DROP } from "../media.drag";
import { mediaRef } from "../media.ref";
import type { MediaDragDetail } from "../media.types";
import { BinNameField } from "./BinNameField";
import { TreeRow } from "./SmartBinList";

interface BinRowProps {
  /** Null is Master. */
  binId: BinId | null;
  label: string;
  count: number;
  active: boolean;
  depth: number;
}

/** A bin in the tree: opens on a click, takes dropped files, and renames or deletes on a right click. */
export function BinRow({ binId, label, count, active, depth }: BinRowProps) {
  const { bus } = useKernel();
  const { view } = useModule(mediaRef);
  const row = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    const target = row.current;
    if (!target) return;
    const onDrop = (event: Event) => {
      const { item } = (event as CustomEvent<MediaDragDetail>).detail;
      if (item.type !== "media") return;
      event.stopPropagation();
      void bus.run(moveToBin, { mediaIds: [item.id], binId });
    };
    target.addEventListener(MEDIA_DROP, onDrop);
    return () => target.removeEventListener(MEDIA_DROP, onDrop);
  }, [bus, binId]);

  const tree = (
    <TreeRow
      icon={Folder}
      label={label}
      count={count}
      active={active}
      depth={depth}
      onClick={() => view.setState({ place: { kind: "bin", binId } })}
    />
  );
  if (renaming && binId !== null) {
    return (
      <BinNameField
        depth={depth}
        initial={label}
        onDone={(name) => {
          setRenaming(false);
          if (name) void bus.run(renameBin, { binId, name });
        }}
      />
    );
  }
  return (
    <div ref={row}>
      {binId === null ? (
        tree
      ) : (
        <ContextMenu
          items={[
            { label: "Rename", onSelect: () => setRenaming(true) },
            {
              label: "Delete bin",
              destructive: true,
              onSelect: () => void bus.run(deleteBin, { binId }),
            },
          ]}
        >
          {tree}
        </ContextMenu>
      )}
    </div>
  );
}
