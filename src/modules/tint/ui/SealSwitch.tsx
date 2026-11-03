import { Crown } from "lucide-react";
import { useStore } from "zustand";
import { pagesRef, useModule } from "@/core";
import { cn, SealMark } from "@/ui";
import { TINT_PAGE } from "../tint.ref";
import type { TintMode } from "../tint.types";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

const MODES: readonly { mode: TintMode; name: string; note: string; tip: string }[] = [
  {
    mode: "baby",
    name: "Baby Seal",
    note: "layers",
    tip: "Baby Seal: the grade as layers, top to bottom",
  },
  {
    mode: "leader",
    name: "Leader Seal",
    note: "nodes",
    tip: "Leader Seal: the same grade as nodes and wires",
  },
];

/** Baby Seal | Leader Seal, in the top bar while the Tint page is open. The same grade either way. */
export function SealSwitch() {
  const page = useStore(useModule(pagesRef).store, (s) => s.active);
  const mode = useTintView((v) => v.mode);
  const set = useTintSet();
  if (page !== TINT_PAGE) return null;
  return (
    <div
      role="radiogroup"
      aria-label="How the grade is shown"
      className="flex rounded-md bg-background p-0.5 shadow-[inset_0_0_0_1px_var(--border-strong)]"
    >
      {MODES.map((m) => (
        <button
          key={m.mode}
          type="button"
          role="radio"
          aria-checked={mode === m.mode}
          title={m.tip}
          onClick={() => set({ mode: m.mode })}
          className={cn(
            "flex h-[30px] cursor-pointer items-center gap-1.5 rounded-sm pr-3 pl-2 font-hand text-base font-bold",
            mode === m.mode
              ? "bg-muted text-foreground shadow-[inset_0_-2px_0_var(--mark)]"
              : "text-subtle-foreground hover:text-foreground",
          )}
        >
          <span className="relative">
            <SealMark className={m.mode === "baby" ? "h-3.5 w-4" : "h-4 w-5"} />
            {m.mode === "leader" && (
              <Crown className="absolute -top-2 left-1.5 size-2.5 fill-mark text-mark" />
            )}
          </span>
          {m.name}
          <span className="font-mono text-2xs font-normal text-subtle-foreground">{m.note}</span>
        </button>
      ))}
    </div>
  );
}
