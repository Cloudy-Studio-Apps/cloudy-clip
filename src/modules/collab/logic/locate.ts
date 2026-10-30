import type { ScreenBox, TimelineApi } from "@/modules/timeline";
import type { CollabTarget, PointerSpot } from "../collab.types";

/** Room kept at the timeline's edges: the arrow and its label hang to the right of its tip. */
const EDGE_LEFT = 8;
const EDGE_RIGHT = 240;
const EDGE_Y = 36;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Where a marked element is. A `contents` wrapper has no box of its own: its child does. */
function boxOf(target: string): ScreenBox | null {
  for (const element of document.querySelectorAll(`[data-collab-target="${target}"]`)) {
    const box = element.getBoundingClientRect();
    if (box.width > 0) return box;
    const child = element.firstElementChild?.getBoundingClientRect();
    if (child && child.width > 0) return child;
  }
  return null;
}

const centerOf = (box: ScreenBox): PointerSpot => ({
  x: (box.left + box.right) / 2,
  y: (box.top + box.bottom) / 2,
});

/** The panel a marked thing lives in, for when it isn't on screen. */
function fallback(target: CollabTarget): string {
  if (target.startsWith("media:") || target.startsWith("composition:")) {
    return "panel:media.library";
  }
  if (target.startsWith("inspector:")) return "panel:inspector.panel";
  return "panel:timeline.panel";
}

/**
 * The spot on screen for a target. A clip the timeline hasn't rendered, or that is scrolled away,
 * gives the edge of the timeline nearest it. A clip in a composition the user doesn't have open
 * (`compositionOfClip` says which) gives that composition's tab or Library tile. Null when there
 * is nowhere to point.
 */
export function locate(
  target: CollabTarget,
  timeline: TimelineApi,
  compositionOfClip: (clipId: string) => string | null,
): PointerSpot | null {
  if (target.startsWith("clip:")) {
    const clipId = target.slice("clip:".length);
    const home = compositionOfClip(clipId);
    if (home !== null) {
      const tab = boxOf(`composition:${home}`);
      if (tab) return centerOf(tab);
    }
    const box = timeline.clipBox(clipId);
    const panel = timeline.panelBox();
    if (box && panel) {
      const { x, y } = centerOf(box);
      return {
        x: clamp(x, panel.left + EDGE_LEFT, panel.right - EDGE_RIGHT),
        y: clamp(y, panel.top, panel.bottom - EDGE_Y),
      };
    }
  }
  const box = boxOf(target) ?? boxOf(fallback(target));
  return box ? centerOf(box) : null;
}
