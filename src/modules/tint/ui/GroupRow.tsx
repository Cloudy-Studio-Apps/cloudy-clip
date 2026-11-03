import { Eye, Folder } from "lucide-react";
import { cn } from "@/ui";
import type { DemoGroup } from "./demo/demo.types";
import { LayerRow } from "./LayerRow";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

const KIND_NAMES: Record<DemoGroup["kind"], string> = {
  parallel: "Side by side",
  layer: "Stacked",
  channels: "Per channel",
};

/** A group of layers: a folder with its blend, opacity and on/off, its layers indented. */
export function GroupRow({ group }: { group: DemoGroup }) {
  const selected = useTintView((v) => v.selected === group.id);
  const set = useTintSet();
  return (
    <div
      className={cn(
        "rounded-sm bg-primary-soft/20 px-2 pt-1.5 pb-2",
        selected
          ? "shadow-[inset_0_0_0_1.5px_var(--mark)]"
          : "shadow-[inset_0_0_0_1px_var(--border-strong)]",
      )}
    >
      <button
        type="button"
        onClick={() => set({ selected: group.id })}
        className="flex w-full cursor-pointer items-center gap-2 px-0.5 pt-1 pb-2 font-hand text-base font-bold"
      >
        <Folder className="size-4 text-primary" />
        {group.name}
        <span className="rounded-xs px-1 font-mono text-2xs text-muted-foreground shadow-[inset_0_0_0_1px_var(--border-strong)]">
          {KIND_NAMES[group.kind]}
        </span>
        <span className="flex-1" />
        <span className="font-mono text-xs font-normal text-muted-foreground">
          {group.opacity}%
        </span>
        <Eye className="size-3.5 text-muted-foreground" />
      </button>
      <div className="ml-2.5 flex flex-col gap-1.5 border-l-[1.5px] border-dashed border-border-strong pl-3">
        {group.layers.map((layer) => (
          <LayerRow key={layer.id} layer={layer} />
        ))}
      </div>
      <p className="pt-2 pl-6 text-xs text-subtle-foreground">
        Both start from 02 and are blended back together.
      </p>
    </div>
  );
}
