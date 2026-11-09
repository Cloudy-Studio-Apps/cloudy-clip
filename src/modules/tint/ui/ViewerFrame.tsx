import { PreviewStage } from "@/modules/preview";
import { FalseColorLegend } from "./FalseColorLegend";
import { FALSE_COLOR_FILTER, FalseColorFilter } from "./FalseColorFilter";
import { FrameTag } from "./FrameTag";
import { GuidesOverlay } from "./GuidesOverlay";
import { SamplePoints } from "./SamplePoints";
import { useTintView } from "./view.hook";

/**
 * The preview's own stage (bare: just the picture, so it plays and takes the preview's grades),
 * with whatever the viewer tools turn on drawn over it. Before/after, bypass and the false color
 * stand-in are still demo: they mark the frame but don't change what the preview draws.
 */
export function ViewerFrame() {
  const compare = useTintView((v) => v.compare);
  const bypass = useTintView((v) => v.bypass);
  const falseColor = useTintView((v) => v.falseColor);
  const warning = useTintView((v) => v.warning);
  const guides = useTintView((v) => v.guides);
  const samples = useTintView((v) => v.samples);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-stage">
      <FalseColorFilter />
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ filter: falseColor ? `url(#${FALSE_COLOR_FILTER})` : undefined }}
      >
        <PreviewStage bare />
      </div>
      <div className="pointer-events-none absolute inset-0">
        {compare && (
          <>
            <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-foreground" />
            <FrameTag side="left">Before</FrameTag>
          </>
        )}
        <FrameTag side="right">{bypass ? "Grades off" : "After"}</FrameTag>
        {warning && <FrameTag side="center">Clip warning on</FrameTag>}
        {falseColor && <FalseColorLegend />}
        {guides && <GuidesOverlay />}
        {samples && <SamplePoints />}
      </div>
    </div>
  );
}
