import type { ClipPlacement, ClipTransform, ProjectFormat } from "@/modules/project";

/** CSS that puts an element over a placed picture, in % of the frame (zoom-independent). */
export function boxStyle(
  placement: ClipPlacement,
  format: ProjectFormat,
): { left: string; top: string; width: string; height: string; transform: string } {
  return {
    left: `${((placement.cx - placement.width / 2) / format.width) * 100}%`,
    top: `${((placement.cy - placement.height / 2) / format.height) * 100}%`,
    width: `${(placement.width / format.width) * 100}%`,
    height: `${(placement.height / format.height) * 100}%`,
    transform: `rotate(${placement.rotation}deg)`,
  };
}

/** Writes `boxStyle` straight to the element (gesture feedback without React renders). */
export function applyBox(
  element: HTMLElement,
  placement: ClipPlacement,
  format: ProjectFormat,
): void {
  Object.assign(element.style, boxStyle(placement, format));
}

/**
 * Where the pivot sits inside the box, in % of it. The box is never mirrored (CSS turns it about
 * its center), so a flipped axis puts the pivot on the other side.
 */
export function pivotStyle(transform: ClipTransform): { left: string; top: string } {
  const sx = transform.scaleX < 0 ? -1 : 1;
  const sy = transform.scaleY < 0 ? -1 : 1;
  return {
    left: `${50 + transform.pivotX * sx * 100}%`,
    top: `${50 + transform.pivotY * sy * 100}%`,
  };
}
