import { useRef } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { PreviewStage, previewRef } from "@/modules/preview";
import { ChartOverlay } from "./ChartOverlay";
import { FalseColorLegend } from "./FalseColorLegend";
import { FrameBox } from "./FrameBox";
import { FrameTag } from "./FrameTag";
import { GuidesOverlay } from "./GuidesOverlay";
import { SamplePoints } from "./SamplePoints";
import { SideBySide } from "./SideBySide";
import { VIEWER_FRAME_ATTR } from "./ZoomChip";
import { ViewerPicker } from "./ViewerPicker";
import { useTintView } from "./view.hook";

/**
 * The preview's own stage (bare: just the picture, so it plays and takes the preview's grades),
 * with whatever the viewer tools turn on drawn over it. Before/after and bypass are the preview's
 * own (`picture.setCompare`, `setBypass`); its wipe line is the divider. False color and the clip
 * warning are viewer passes (`tint.viewer.ts`) drawn by the preview itself, so there is nothing
 * of them here but the legend and tag. Guides, sample points and side by side sit in a `FrameBox`,
 * exactly over the picture. While a tool picks a color, `ViewerPicker` takes the next click on the
 * picture; while Match places a color chart, `ChartOverlay` shows its grid and corners.
 */
export function ViewerFrame() {
  const { picture } = useModule(previewRef);
  const comparing = useStore(picture.view, (v) => v.compare !== null);
  const bypass = useStore(picture.view, (v) => v.bypass);
  const falseColor = useTintView((v) => v.falseColor);
  const warning = useTintView((v) => v.warning);
  const guides = useTintView((v) => v.guides);
  const samples = useTintView((v) => v.samples);
  const side = useTintView((v) => v.side);
  const stage = useRef<HTMLDivElement>(null);
  return (
    <div
      {...{ [VIEWER_FRAME_ATTR]: "" }}
      className="relative flex min-h-0 flex-1 flex-col bg-stage"
    >
      <div ref={stage} className="flex min-h-0 flex-1 flex-col">
        <PreviewStage bare />
      </div>
      <div className="pointer-events-none absolute inset-0">
        {comparing && <FrameTag side="left">Before</FrameTag>}
        <FrameTag side="right">{bypass ? "Grades off" : "After"}</FrameTag>
        {warning && !falseColor && <FrameTag side="center">Clip warning on</FrameTag>}
        {falseColor && <FalseColorLegend />}
      </div>
      {(guides || samples || side) && (
        <FrameBox stage={stage}>
          {side && <SideBySide source={side} />}
          {guides && <GuidesOverlay />}
          {samples && <SamplePoints pins={samples} />}
        </FrameBox>
      )}
      <ChartOverlay stage={stage} />
      <ViewerPicker stage={stage} />
    </div>
  );
}
