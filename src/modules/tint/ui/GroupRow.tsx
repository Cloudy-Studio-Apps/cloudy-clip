import { Eye, EyeOff, Folder } from "lucide-react";
import { cn } from "@/ui";
import type { StackItem } from "../tint.types";
import { useLayers } from "./layers.context";
import { StackItems } from "./StackItems";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

type Group = Extract<StackItem, { type: "group" }>;

const KIND_NAMES: Record<Group["kind"], string> = {
  parallel: "Side by side",
  layer: "Stacked",
  channels: "Per channel",
};

/** A group of layers: a folder with its blend, opacity and on/off, its layers indented. */
export function GroupRow({ group }: { group: Group }) {
  const { grade } = useLayers();
  const join = grade.nodes[group.id];
  const on = join && "on" in join ? join.on : true;
  const opacity = join && "opacity" in join ? join.opacity : 1;
  const Visible = on ? Eye : EyeOff;
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
        {KIND_NAMES[group.kind]} group
        <span className="flex-1" />
        <span className="font-mono text-xs font-normal text-muted-foreground">
          {Math.round(opacity * 100)}%
        </span>
        <Visible className="size-3.5 text-muted-foreground" />
      </button>
      <div className="ml-2.5 flex flex-col gap-1.5 border-l-[1.5px] border-dashed border-border-strong pl-3">
        {group.branches.map((branch, index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <StackItems items={branch} nested />
          </div>
        ))}
      </div>
      <p className="pt-2 pl-6 text-xs text-subtle-foreground">
        Each branch starts from the picture above and they are blended back together.
      </p>
    </div>
  );
}
