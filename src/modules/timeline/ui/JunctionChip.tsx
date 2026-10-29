import { memo, useRef } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { junctionRef } from "@/modules/junction";
import { projectRef } from "@/modules/project";
import { cn } from "@/ui";
import { timelineRef } from "../timeline.ref";
import type { JunctionChipInfo } from "../timeline.types";
import { chipBox, startJunctionDrag } from "./junction.gesture";

interface JunctionChipProps {
  chip: JunctionChipInfo;
  pxPerSecond: number;
}

/** The glass chip on a cut: icon and name. Click selects, the edges drag the duration. */
export const JunctionChip = memo(function JunctionChip({ chip, pxPerSecond }: JunctionChipProps) {
  const project = useModule(projectRef).store;
  const junctions = useModule(junctionRef);
  const timeline = useModule(timelineRef);
  const { bus } = useKernel();
  const ref = useRef<HTMLDivElement>(null);
  const { junction, icon: Icon } = chip;
  const selected = useStore(timeline.view, (s) => s.junctionSelection.includes(junction.id));
  const box = chipBox(chip.leftEnd, junction.duration, pxPerSecond);
  const draggable = Boolean(junctions.get(junction.kind)?.definition.overlap);

  const grab = (edge: "start" | "end") => (e: React.PointerEvent) => {
    const kind = junctions.get(junction.kind)?.definition;
    const state = project.getState();
    const left = state.clips[junction.leftClipId];
    const right = state.clips[junction.rightClipId];
    if (e.button !== 0 || !ref.current || !kind || !left || !right) return;
    e.stopPropagation();
    timeline.selectJunction(junction.id);
    startJunctionDrag({
      bus,
      chip,
      kind,
      state,
      left,
      right,
      element: ref.current,
      edge,
      down: e.nativeEvent,
      pxPerSecond,
    });
  };

  return (
    <div
      ref={ref}
      data-junction-id={junction.id}
      className={cn(
        "absolute bottom-[3px] top-[3px] z-20 flex items-center justify-center gap-1 overflow-hidden rounded-md border bg-foreground/10 px-1 text-2xs font-medium backdrop-blur-sm select-none",
        selected ? "border-foreground" : "border-foreground/30",
        chip.missing ? "text-muted-foreground" : "text-foreground",
      )}
      style={{ left: box.left, width: box.width }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        timeline.selectJunction(junction.id);
      }}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{chip.label}</span>
      {draggable && (
        <>
          <div
            className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize"
            onPointerDown={grab("start")}
          />
          <div
            className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize"
            onPointerDown={grab("end")}
          />
        </>
      )}
    </div>
  );
});
