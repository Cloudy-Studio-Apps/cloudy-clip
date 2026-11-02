import type { ClipComposite } from "@/modules/project";
import { canvasBlend } from "../logic/blend";

/**
 * Lands a finished full-frame picture on `target` with its blend mode and opacity, as one image, so
 * a picture painted in several passes (text) fades and blends as a whole.
 */
export function landLayer(
  target: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  { mode, opacity }: ClipComposite,
): void {
  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.globalAlpha = opacity;
  target.globalCompositeOperation = canvasBlend(mode);
  target.drawImage(source, 0, 0);
  target.restore();
}
