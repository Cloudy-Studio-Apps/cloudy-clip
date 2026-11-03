import { DEMO_FRAME, DEMO_GRADED } from "./demo/demo.images";
import { FalseColorLegend } from "./FalseColorLegend";
import { FALSE_COLOR_FILTER, FalseColorFilter } from "./FalseColorFilter";
import { FrameTag } from "./FrameTag";
import { GuidesOverlay } from "./GuidesOverlay";
import { SamplePoints } from "./SamplePoints";
import { useTintView } from "./view.hook";

/** The demo picture, graded, with whatever the viewer tools turn on drawn over it. */
export function ViewerFrame() {
  const compare = useTintView((v) => v.compare);
  const bypass = useTintView((v) => v.bypass);
  const falseColor = useTintView((v) => v.falseColor);
  const warning = useTintView((v) => v.warning);
  const guides = useTintView((v) => v.guides);
  const samples = useTintView((v) => v.samples);
  const graded = bypass ? "none" : DEMO_GRADED;
  const filter = falseColor ? `${graded} url(#${FALSE_COLOR_FILTER})` : graded;
  return (
    <div className="relative grid min-h-0 flex-1 place-items-center bg-stage [container-type:size]">
      <FalseColorFilter />
      <div className="relative aspect-video w-[min(100cqw-64px,(100cqh-56px)*16/9)] overflow-hidden bg-stage shadow-[0_0_0_1px_var(--border-strong)]">
        <img
          src={DEMO_FRAME}
          alt=""
          draggable={false}
          className="absolute inset-0 size-full object-cover"
          style={{ filter }}
        />
        {compare && (
          <>
            <img
              src={DEMO_FRAME}
              alt=""
              draggable={false}
              className="absolute inset-0 size-full object-cover"
              style={{ clipPath: "inset(0 50% 0 0)" }}
            />
            <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 cursor-ew-resize bg-foreground" />
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
