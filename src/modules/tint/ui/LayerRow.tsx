import { Eye, EyeOff, GripVertical } from "lucide-react";
import { useState } from "react";
import { cn } from "@/ui";
import { layerChip } from "../logic/layers";
import { LayerChip } from "./LayerChip";
import { LayerThumb } from "./LayerThumb";
import { useLayers } from "./layers.context";
import { OpacityScrub } from "./OpacityScrub";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

/** One correction in the layer list: grip, on/off, picture, number and name, what it changes, opacity. */
export function LayerRow({ id, nested = false }: { id: string; nested?: boolean }) {
  const { subject, grade, numbers, thumbs, actions, drag } = useLayers();
  const node = grade.nodes[id];
  const selected = useTintView((v) => v.selected === id);
  const set = useTintSet();
  const [renaming, setRenaming] = useState(false);
  if (node?.kind !== "correct") return null;
  const name = node.name || "Correction";
  const Visible = node.on ? Eye : EyeOff;
  const rename = (value: string) => {
    setRenaming(false);
    const next = value.trim();
    if (next && next !== name) actions.change(id, { name: next });
  };
  return (
    <div
      role="button"
      tabIndex={0}
      data-layer-id={id}
      data-nested={nested}
      onClick={() => set({ selected: id })}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter") set({ selected: id });
        if (event.key === "Delete" || event.key === "Backspace") actions.remove(id);
      }}
      className={cn(
        "relative grid cursor-pointer grid-cols-[12px_22px_64px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-sm bg-muted py-1.5 pr-2.5 pl-2 outline-none",
        selected
          ? "shadow-[inset_0_0_0_1.5px_var(--mark)]"
          : "shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1px_var(--border-strong)]",
      )}
    >
      <GripVertical
        aria-label="Drag to reorder"
        className="size-3 cursor-grab touch-none text-subtle-foreground"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          drag(event.nativeEvent, id);
        }}
      />
      <button
        type="button"
        title={node.on ? "On: click to turn off" : "Off: click to turn on"}
        onClick={(event) => {
          event.stopPropagation();
          actions.change(id, { on: !node.on });
        }}
        className="grid size-[22px] cursor-pointer place-items-center text-muted-foreground hover:text-foreground"
      >
        <Visible className="size-3.5" />
      </button>
      <LayerThumb src={thumbs[id]} dim={!node.on} />
      <span className="min-w-0">
        <span
          className="block truncate font-hand text-base font-bold"
          onDoubleClick={() => setRenaming(true)}
          title="Double-click to rename"
        >
          <span className="mr-1.5 font-mono text-xs text-subtle-foreground">{numbers[id]}</span>
          {renaming ? (
            <input
              autoFocus
              defaultValue={node.name ?? ""}
              placeholder={name}
              aria-label="Layer name"
              onClick={(event) => event.stopPropagation()}
              onBlur={(event) => rename(event.currentTarget.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") rename(event.currentTarget.value);
                if (event.key === "Escape") setRenaming(false);
              }}
              className="w-3/4 rounded-xs bg-surface px-1 font-hand text-base font-bold outline-none"
            />
          ) : (
            name
          )}
        </span>
        <span className="mt-1 flex">
          <LayerChip chip={layerChip(node, numbers)} />
        </span>
      </span>
      <OpacityScrub subject={subject} nodeId={id} opacity={node.opacity} />
    </div>
  );
}
