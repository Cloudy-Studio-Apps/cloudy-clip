import type { ScreenBox, TimelineApi } from "@/modules/timeline";
import type { CollabTarget, PointerSpot } from "../collab.types";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Where a marked element is. A `contents` wrapper has no box of its own: its child does. */
function boxOf(target: string): ScreenBox | null {
  const element = document.querySelector(`[data-collab-target="${target}"]`);
  if (!element) return null;
  const box = element.getBoundingClientRect();
  if (box.width > 0) return box;
  return element.firstElementChild?.getBoundingClientRect() ?? null;
}

const centerOf = (box: ScreenBox): PointerSpot => ({
  x: (box.left + box.right) / 2,
  y: (box.top + box.bottom) / 2,
});

/** The panel a marked thing lives in, for when it isn't on screen. */
function fallback(target: CollabTarget): string {
  if (target.startsWith("media:")) return "panel:media.library";
  if (target.startsWith("inspector:")) return "panel:inspector.panel";
  return "panel:timeline.panel";
}

/**
 * The spot on screen for a target. A clip the timeline hasn't rendered, or that is scrolled away,
 * gives the edge of the timeline nearest it. Null when there is nowhere to point.
 */
export function locate(target: CollabTarget, timeline: TimelineApi): PointerSpot | null {
  if (target.startsWith("clip:")) {
    const box = timeline.clipBox(target.slice("clip:".length));
    const panel = timeline.panelBox();
    if (box && panel) {
      const { x, y } = centerOf(box);
      return { x: clamp(x, panel.left, panel.right), y: clamp(y, panel.top, panel.bottom) };
    }
  }
  const box = boxOf(target) ?? boxOf(fallback(target));
  return box ? centerOf(box) : null;
}
