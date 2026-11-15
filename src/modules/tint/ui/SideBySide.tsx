import type { SideSource } from "../tint.types";
import { useSideImage } from "./side.image.hook";

/**
 * Side by side, inside a `FrameBox`: the left half of the picture area shows another picture (a
 * still, or another clip's frame) where the graded picture would be, with a line where they meet.
 */
export function SideBySide({ source }: { source: SideSource }) {
  const src = useSideImage(source);
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 w-1/2 overflow-hidden border-r border-foreground/70 bg-stage">
      {src && <img src={src} alt="" className="h-full w-[200%] max-w-none" />}
    </div>
  );
}
