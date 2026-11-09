import { useRef } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { PreviewStage, previewRef } from "@/modules/preview";
import { FalseColorLegend } from "./FalseColorLegend";
import { FALSE_COLOR_FILTER, FalseColorFilter } from "./FalseColorFilter";
import { FrameTag } from "./FrameTag";
import { GuidesOverlay } from "./GuidesOverlay";
import { HuePicker } from "./HuePicker";
import { SamplePoints } from "./SamplePoints";
import { useTintView } from "./view.hook";

/**
 * The preview's own stage (bare: just the picture, so it plays and takes the preview's grades),
 * with whatever the viewer tools turn on drawn over it. Before/after and bypass are the preview's
 * own (`picture.setCompare`, `setBypass`); its wipe line is the divider. The false color stand-in
 * is still demo: it marks the frame but doesn't change what the preview draws. While the Curves
 * tool picks a hue, `HuePicker` takes the next click on the picture.
 */
export function ViewerFrame() {
  const { picture } = useModule(previewRef);
  const comparing = useStore(picture.view, (v) => v.compare !== null);
  const bypass = useStore(picture.view, (v) => v.bypass);
  const falseColor = useTintView((v) => v.falseColor);
  const warning = useTintView((v) => v.warning);
  const guides = useTintView((v) => v.guides);
  const samples = useTintView((v) => v.samples);
  const stage = useRef<HTMLDivElement>(null);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-stage">
      <FalseColorFilter />
      <div
        ref={stage}
        className="flex min-h-0 flex-1 flex-col"
        style={{ filter: falseColor ? `url(#${FALSE_COLOR_FILTER})` : undefined }}
      >
        <PreviewStage bare />
      </div>
      <div className="pointer-events-none absolute inset-0">
        {comparing && <FrameTag side="left">Before</FrameTag>}
        <FrameTag side="right">{bypass ? "Grades off" : "After"}</FrameTag>
        {warning && <FrameTag side="center">Clip warning on</FrameTag>}
        {falseColor && <FalseColorLegend />}
        {guides && <GuidesOverlay />}
        {samples && <SamplePoints />}
      </div>
      <HuePicker stage={stage} />
    </div>
  );
}
