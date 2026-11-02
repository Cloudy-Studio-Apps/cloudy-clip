import { memo, useRef } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { junctionRef } from "@/modules/junction";
import { projectRef } from "@/modules/project";
import { cn } from "@/ui";
import { timeToPx } from "../logic/geometry";
import { timelineRef } from "../timeline.ref";
import type { JunctionChipInfo } from "../timeline.types";
import { chipBox, startJunctionDrag } from "./junction.gesture";

interface JunctionChipProps {
  chip: JunctionChipInfo;
  pxPerSecond: number;
}

/** A long pencil X across a cut, as on film stock. Click selects, the edges drag the duration. */
export const JunctionChip = memo(function JunctionChip({ chip, pxPerSecond }: JunctionChipProps) {
  const project = useModule(projectRef).store;
  const junctions = useModule(junctionRef);
  const timeline = useModule(timelineRef);
  const { bus } = useKernel();
  const ref = useRef<HTMLDivElement>(null);
  const { junction } = chip;
  const selected = useStore(timeline.view, (s) => s.junctionSelection.includes(junction.id));
  const shift = useStore(timeline.view, (s) => s.cutPreview?.shifts[junction.leftClipId] ?? 0);
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
      title={chip.label}
      className={cn(
        "absolute bottom-[3px] top-[3px] z-20 select-none bg-[linear-gradient(to_top_right,transparent_48.4%,var(--x)_48.4%,var(--x)_51.6%,transparent_51.6%),linear-gradient(to_bottom_right,transparent_48.4%,var(--x)_48.4%,var(--x)_51.6%,transparent_51.6%)]",
        chip.missing ? "[--x:var(--subtle-foreground)]" : "[--x:var(--mark)]",
        selected && "outline-2 outline-mark",
      )}
      style={{ left: box.left + timeToPx(shift, pxPerSecond), width: box.width }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        timeline.selectJunction(junction.id);
      }}
    >
      <span className="sr-only">{chip.label}</span>
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
