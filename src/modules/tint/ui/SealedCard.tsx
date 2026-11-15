import { ChevronDown, Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";
import { useKernel } from "@/core";
import type { Correction } from "@/modules/project";
import { cn } from "@/ui";
import { setCorrection } from "../tint.node.commands";
import { selectNode, setMode } from "../tint.view.commands";
import type { StackItem } from "../tint.types";
import { LayerRow } from "./LayerRow";
import { useLayers } from "./layers.context";
import { SealedOpacity } from "./SealedOpacity";
import { settle } from "./settle";
import { useTintView } from "./view.hook";

/** Red, green and blue as data colors: the channels the card splits into. */
const CHANNELS = ["#e0545a", "#4fbf6a", "#4d8fe0"] as const;

/**
 * Part of the grade wired in Leader Seal that has no layer shape. Its values stay editable
 * (expand it); its wiring changes only in Leader Seal.
 */
export function SealedCard({ card }: { card: Extract<StackItem, { type: "sealed" }> }) {
  const { clipId, grade } = useLayers();
  const { bus } = useKernel();
  const corrections = card.nodes.filter((id) => grade.nodes[id]?.kind === "correct");
  const first = grade.nodes[corrections[0] ?? ""] as Correction | undefined;
  const on = corrections.some((id) => (grade.nodes[id] as Correction).on);
  const [open, setOpen] = useState(false);
  const selected = useTintView((v) => v.selected === card.id);
  // Leader Seal, with the card's first node selected.
  const openGraph = () => {
    void bus.run(setMode, { mode: "leader" });
    void bus.run(selectNode, { nodeId: card.nodes[0] ?? null });
  };
  const toggle = async () => {
    for (const nodeId of corrections) {
      const patch = { on: !on };
      if (!(await settle(bus.run(setCorrection, { target: { clipId }, nodeId, patch }))).ok) break;
    }
  };
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
        <button
          type="button"
          title={on ? "On: click to turn everything inside off" : "Off: click to turn it on"}
          onClick={() => void toggle()}
          className="grid size-[22px] cursor-pointer place-items-center text-muted-foreground hover:text-foreground"
        >
          {on ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </button>
        <span className="flex h-9 items-center justify-center gap-1">
          {CHANNELS.map((color) => (
            <i key={color} className="block h-5 w-2.5 rounded-xs" style={{ background: color }} />
          ))}
        </span>
        <div className="min-w-0">
          <span className="block font-hand text-base font-bold">Sealed part</span>
          <span className="block text-xs text-subtle-foreground">
            Wired in Leader Seal · edit the wiring there
          </span>
          <button
            type="button"
            onClick={openGraph}
            className="mt-0.5 cursor-pointer text-xs text-primary hover:underline"
          >
            Open
          </button>
        </div>
        <span className="flex items-center gap-1.5">
          {first && <SealedOpacity clipId={clipId} ids={corrections} opacity={first.opacity} />}
          <button
            type="button"
            aria-label={open ? "Hide its corrections" : "Show its corrections"}
            onClick={() => setOpen(!open)}
            className="grid size-6 cursor-pointer place-items-center rounded-xs text-muted-foreground hover:bg-hover"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </button>
        </span>
      </div>
      {open && (
        <div className="mt-2 ml-2.5 flex flex-col gap-1.5 border-l-[1.5px] border-dashed border-border-strong pl-3">
          {corrections.map((id) => (
            <LayerRow key={id} id={id} nested />
          ))}
        </div>
      )}
    </div>
  );
}
