import { Folder } from "lucide-react";
import { useState } from "react";
import { useKernel, useModule } from "@/core";
import type { BinId } from "@/modules/project";
import { ContextMenu } from "@/ui";
import { deleteBin, renameBin } from "../media.bin.commands";
import { mediaRef } from "../media.ref";
import { useBinDrop } from "./bin.drop.hook";
import { BinNameField } from "./BinNameField";
import { TreeRow } from "./TreeRow";

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
  const row = useBinDrop(binId);
  const [renaming, setRenaming] = useState(false);

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
