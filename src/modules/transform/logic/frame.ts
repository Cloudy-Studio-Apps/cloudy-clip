import type { ProjectFormat } from "@/modules/project";
import type { FramePoint, ScreenRect } from "../transform.types";

/** A screen point as a point in the frame, in output pixels. */
export function screenToFrame(
  rect: ScreenRect,
  format: ProjectFormat,
  clientX: number,
  clientY: number,
): FramePoint {
  return {
    x: ((clientX - rect.left) / rect.width) * format.width,
    y: ((clientY - rect.top) / rect.height) * format.height,
  };
}

/** A screen point as a point in the frame element's output pixels. */
export function toFramePoint(
  frame: HTMLElement,
  format: ProjectFormat,
  clientX: number,
  clientY: number,
): FramePoint {
  return screenToFrame(frame.getBoundingClientRect(), format, clientX, clientY);
}
