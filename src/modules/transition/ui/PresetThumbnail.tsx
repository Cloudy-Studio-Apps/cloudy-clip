import type { RefObject } from "react";
import { THUMB_HEIGHT, THUMB_WIDTH } from "../transition.layout";

/** The canvas a preset's thumbnail is drawn on (see `usePresetThumbnail`). */
export function PresetThumbnail({ canvasRef }: { canvasRef: RefObject<HTMLCanvasElement | null> }) {
  return (
    <canvas
      ref={canvasRef}
      width={THUMB_WIDTH}
      height={THUMB_HEIGHT}
      className="block aspect-video w-full rounded-xs bg-surface-sunken"
    />
  );
}
