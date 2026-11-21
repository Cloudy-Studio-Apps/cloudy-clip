import { useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { report, useKernel, useModule } from "@/core";
import { MARKER_HEX, projectRef, type SubtitleStyle } from "@/modules/project";
import { cn } from "@/ui";
import { renameStyle, reorderStyles } from "../subtitle.style.commands";

interface StyleListProps {
  compositionId: string;
  styles: readonly SubtitleStyle[];
  selectedId: string | undefined;
  onSelect(styleId: string): void;
}

/**
 * The composition's styles: color dot, name and cue count. A click selects, a double-click
 * renames, a drag reorders; the first is the default.
 */
export function StyleList({ compositionId, styles, selectedId, onSelect }: StyleListProps) {
  const { bus } = useKernel();
  const clips = useStore(useModule(projectRef).store.api, (s) => s.clips);
  const counts = useMemo(() => {
    const by = new Map<string, number>();
    for (const clip of Object.values(clips)) {
      const id = clip.subtitle?.styleId;
      if (id) by.set(id, (by.get(id) ?? 0) + 1);
    }
    return by;
  }, [clips]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const dragged = useRef<string | null>(null);

  const rename = (style: SubtitleStyle, name: string) => {
    setRenaming(null);
    const trimmed = name.trim();
    if (trimmed && trimmed !== style.name) {
      void bus.run(renameStyle, { styleId: style.id, name: trimmed }).then(report);
    }
  };
  const drop = (target: string) => {
    const from = dragged.current;
    dragged.current = null;
    if (!from || from === target) return;
    const ids = styles.map((s) => s.id);
    const to = ids.indexOf(target);
    ids.splice(ids.indexOf(from), 1);
    ids.splice(to, 0, from);
    void bus.run(reorderStyles, { compositionId, styleIds: ids }).then(report);
  };

  return (
    <ul role="listbox" aria-label="Subtitle styles">
      {styles.map((style, index) => (
        <li
          key={style.id}
          role="option"
          aria-selected={style.id === selectedId}
          draggable={renaming !== style.id}
          onDragStart={() => (dragged.current = style.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => drop(style.id)}
          onClick={() => onSelect(style.id)}
          onDoubleClick={() => setRenaming(style.id)}
          title="Double-click to rename, drag to reorder"
          className={cn(
            "grid cursor-pointer grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-border px-3 py-[7px] hover:bg-hover",
            style.id === selectedId && "bg-muted shadow-[inset_2px_0_0_var(--mark)]",
          )}
        >
          <i className="size-2.5 rounded-full" style={{ background: MARKER_HEX[style.color] }} />
          {renaming === style.id ? (
            <input
              aria-label="Style name"
              autoFocus
              maxLength={60}
              defaultValue={style.name}
              className="min-w-0 rounded-xs bg-surface-sunken px-1 font-hand text-[13px] font-bold outline-none ring-1 ring-border-strong"
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => rename(style, e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  e.currentTarget.value = style.name;
                  e.currentTarget.blur();
                }
              }}
            />
          ) : (
            <span className="truncate font-hand text-[13px] font-bold">
              {style.name}
              {index === 0 && (
                <small className="ml-1 font-mono text-2xs font-normal text-subtle-foreground">
                  default
                </small>
              )}
            </span>
          )}
          <span className="font-mono text-xs text-subtle-foreground">
            {counts.get(style.id) ?? 0}
          </span>
        </li>
      ))}
    </ul>
  );
}
