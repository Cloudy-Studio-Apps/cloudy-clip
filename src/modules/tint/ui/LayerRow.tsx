import { Eye, EyeOff, GripVertical } from "lucide-react";
import { cn } from "@/ui";
import type { DemoLayer } from "./demo/demo.types";
import { LayerChip } from "./LayerChip";
import { LayerThumb } from "./LayerThumb";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

/** One correction in the layer list: grip, on/off, picture, number and name, what it changes, opacity. */
export function LayerRow({ layer }: { layer: DemoLayer }) {
  const selected = useTintView((v) => v.selected === layer.id);
  const set = useTintSet();
  const Visible = layer.on ? Eye : EyeOff;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => set({ selected: layer.id })}
      onKeyDown={(event) => event.key === "Enter" && set({ selected: layer.id })}
      className={cn(
        "grid cursor-pointer grid-cols-[12px_22px_64px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-sm bg-muted py-1.5 pr-2.5 pl-2",
        selected
          ? "shadow-[inset_0_0_0_1.5px_var(--mark)]"
          : "shadow-[inset_0_0_0_1px_var(--border)] hover:shadow-[inset_0_0_0_1px_var(--border-strong)]",
      )}
    >
      <GripVertical
        aria-label="Drag to reorder"
        className="size-3 cursor-grab text-subtle-foreground"
      />
      <span
        title={layer.on ? "On" : "Off"}
        className="grid size-[22px] place-items-center text-muted-foreground"
      >
        <Visible className="size-3.5" />
      </span>
      <LayerThumb look={layer.look} dim={!layer.on} />
      <span className="min-w-0">
        <span className="block truncate font-hand text-base font-bold">
          <span className="mr-1.5 font-mono text-xs text-subtle-foreground">{layer.no}</span>
          {layer.name}
        </span>
        <span className="mt-1 flex">
          <LayerChip chip={layer.chip} />
        </span>
      </span>
      <span title="Opacity" className="font-mono text-xs text-muted-foreground">
        {layer.opacity}%
      </span>
    </div>
  );
}
