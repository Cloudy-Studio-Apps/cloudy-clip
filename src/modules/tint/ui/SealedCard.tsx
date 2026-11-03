import { ChevronDown, Eye, Lock } from "lucide-react";
import { useState } from "react";
import { cn } from "@/ui";
import type { DemoSealed } from "./demo/demo.types";
import { LayerRow } from "./LayerRow";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

/** Red, green and blue as data colors: the channels the card splits into. */
const CHANNELS = ["#e0545a", "#4fbf6a", "#4d8fe0"] as const;

/**
 * Part of the grade wired in Leader Seal that has no layer shape. Its values stay editable
 * (expand it); its wiring changes only in Leader Seal.
 */
export function SealedCard({ card }: { card: DemoSealed }) {
  const [open, setOpen] = useState(false);
  const selected = useTintView((v) => v.selected === card.id);
  const set = useTintSet();
  return (
    <div
      className={cn(
        "rounded-sm bg-muted bg-[repeating-linear-gradient(135deg,var(--hover)_0_6px,transparent_6px_12px)] p-2",
        selected
          ? "shadow-[inset_0_0_0_1.5px_var(--mark)]"
          : "shadow-[inset_0_0_0_1px_var(--border-strong)]",
      )}
    >
      <div className="grid grid-cols-[12px_22px_64px_minmax(0,1fr)_auto] items-center gap-2.5">
        <Lock className="size-3 text-subtle-foreground" />
        <Eye className="mx-auto size-3.5 text-muted-foreground" />
        <span className="flex h-9 items-center justify-center gap-1">
          {CHANNELS.map((color) => (
            <i key={color} className="block h-5 w-2.5 rounded-xs" style={{ background: color }} />
          ))}
        </span>
        <button
          type="button"
          onClick={() => set({ selected: card.id })}
          className="min-w-0 cursor-pointer text-left"
        >
          <span className="block font-hand text-base font-bold">{card.name}</span>
          <span className="block text-xs text-subtle-foreground">
            Wired in Leader Seal · {card.nodes} nodes ·{" "}
            <span
              role="link"
              tabIndex={0}
              className="cursor-pointer text-primary"
              onClick={(event) => {
                event.stopPropagation();
                set({ mode: "leader", selected: card.id });
              }}
              onKeyDown={(event) => event.key === "Enter" && set({ mode: "leader" })}
            >
              edit the wiring there
            </span>
          </span>
        </button>
        <button
          type="button"
          aria-label={open ? "Hide its corrections" : "Show its corrections"}
          onClick={() => setOpen(!open)}
          className="grid size-6 cursor-pointer place-items-center rounded-xs text-muted-foreground hover:bg-hover"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <div className="mt-2 ml-2.5 flex flex-col gap-1.5 border-l-[1.5px] border-dashed border-border-strong pl-3">
          {card.layers.map((layer) => (
            <LayerRow key={layer.id} layer={layer} />
          ))}
        </div>
      )}
    </div>
  );
}
