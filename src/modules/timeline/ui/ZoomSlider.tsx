import { ZoomIn, ZoomOut } from "lucide-react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { timelineRef } from "../timeline.ref";
import { MAX_PX_PER_SECOND, MIN_PX_PER_SECOND } from "../timeline.store";

// Log scale so the slider feels even from "whole hour" to "single frames".
const RANGE = Math.log(MAX_PX_PER_SECOND / MIN_PX_PER_SECOND);
const toSlider = (pps: number) => Math.log(pps / MIN_PX_PER_SECOND) / RANGE;
const fromSlider = (v: number) => MIN_PX_PER_SECOND * Math.exp(v * RANGE);

/** Timeline zoom (Ctrl + wheel zooms too). */
export function ZoomSlider() {
  const timeline = useModule(timelineRef);
  const pxPerSecond = useStore(timeline.view, (s) => s.pxPerSecond);

  return (
    <label
      className="flex shrink-0 items-center gap-1.5 text-muted-foreground"
      title="Zoom (Ctrl + wheel)"
    >
      <ZoomOut aria-hidden className="size-4" />
      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        aria-label="Zoom"
        value={toSlider(pxPerSecond)}
        onChange={(e) => timeline.setZoom(fromSlider(Number(e.currentTarget.value)))}
        className="w-[90px] accent-primary"
      />
      <ZoomIn aria-hidden className="size-4" />
    </label>
  );
}
