import type { CommandBus } from "@/core";
import {
  clampDuration,
  durationLimits,
  setJunction,
  type JunctionKindDefinition,
} from "@/modules/junction";
import type { Clip, ProjectState } from "@/modules/project";
import { pxToTime, timeToPx } from "../logic/geometry";
import { JUNCTION_MIN_WIDTH_PX } from "../timeline.layout";
import type { JunctionChipInfo } from "../timeline.types";

/** Left and width (px) of a chip for a duration, centered on the cut it ends at `leftEnd`. */
export function chipBox(leftEnd: number, duration: number, pxPerSecond: number) {
  const width = Math.max(timeToPx(duration, pxPerSecond), JUNCTION_MIN_WIDTH_PX);
  const left = timeToPx(leftEnd - duration / 2, pxPerSecond) - width / 2;
  return { left, width };
}

/**
 * Runs a duration drag on one edge of a chip. The chip's `left` and `width` follow the pointer
 * directly (no renders); one `junction.set` is sent on release. The left edge moving left (or the
 * right edge moving right) makes the overlap longer.
 */
export function startJunctionDrag(options: {
  bus: CommandBus;
  chip: JunctionChipInfo;
  kind: JunctionKindDefinition;
  state: ProjectState;
  left: Clip;
  right: Clip;
  element: HTMLElement;
  edge: "start" | "end";
  down: PointerEvent;
  pxPerSecond: number;
}): void {
  const { bus, chip, kind, state, left, right, element, edge, down, pxPerSecond } = options;
  const limits = durationLimits(kind, state, left, right);
  const original = chip.junction.duration;
  let duration = original;

  element.setPointerCapture(down.pointerId);

  function show(d: number): void {
    const box = chipBox(chip.leftEnd, d, pxPerSecond);
    element.style.left = `${box.left}px`;
    element.style.width = `${box.width}px`;
  }

  function onMove(e: PointerEvent): void {
    const dx = pxToTime(e.clientX - down.clientX, pxPerSecond);
    duration = clampDuration(original + (edge === "end" ? dx : -dx), limits);
    show(duration);
  }

  function onEnd(e: PointerEvent): void {
    element.removeEventListener("pointermove", onMove);
    element.removeEventListener("pointerup", onEnd);
    element.removeEventListener("pointercancel", onEnd);
    if (element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId);
    show(original); // the command (if any) re-renders the chip
    if (e.type === "pointerup" && duration !== original) {
      void bus.run(setJunction, { junctionIds: [chip.junction.id], duration });
    }
  }

  element.addEventListener("pointermove", onMove);
  element.addEventListener("pointerup", onEnd);
  element.addEventListener("pointercancel", onEnd);
}
