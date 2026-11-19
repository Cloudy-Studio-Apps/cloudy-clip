import { Spline, Trash2 } from "lucide-react";
import { useState } from "react";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import type { MotionPath } from "@/modules/project";
import { IconButton, cn } from "@/ui";
import { removePaths, updatePath } from "../path.commands";

interface PathRowProps {
  path: MotionPath;
  followers: number;
  selected: boolean;
  onSelect(): void;
}

/** One path in the Library: click selects it, double-click renames it, the bin deletes it. */
export function PathRow({ path, followers, selected, onSelect }: PathRowProps) {
  const { bus } = useKernel();
  const preview = useModule(previewRef);
  const [renaming, setRenaming] = useState(false);

  const rename = (name: string) => {
    setRenaming(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== path.name)
      void bus.run(updatePath, { pathId: path.id, name: trimmed });
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
        selected ? "border-primary bg-primary-soft" : "border-border hover:bg-hover",
      )}
      onClick={onSelect}
      onDoubleClick={() => setRenaming(true)}
    >
      <Spline className="size-3.5 shrink-0 text-muted-foreground" />
      {renaming ? (
        <input
          autoFocus
          aria-label="Path name"
          defaultValue={path.name}
          className="min-w-0 flex-1 rounded-xs border border-border bg-surface px-1 text-xs text-foreground"
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => rename(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") rename(e.currentTarget.value);
            if (e.key === "Escape") setRenaming(false);
          }}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-foreground">{path.name}</span>
      )}
      <span className="text-2xs text-muted-foreground" title="Clips following it">
        {followers}
      </span>
      <IconButton
        label="Delete path"
        onClick={(e) => {
          e.stopPropagation();
          void bus.run(removePaths, { pathIds: [path.id], at: preview.playback.getTime() });
        }}
      >
        <Trash2 />
      </IconButton>
    </div>
  );
}
