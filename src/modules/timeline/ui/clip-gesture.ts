import type { CommandBus, Micros } from "@/core";
import type { StoreApi } from "zustand/vanilla";
import { projectStore, type Clip } from "@/modules/project";
import { getProbe } from "@/modules/media";
import type { PlaybackClock } from "@/modules/preview";
import { pxToTime, timeToPx } from "../logic/geometry";
import {
  clampTrim,
  findOverlap,
  minClipDuration,
  neighbourBounds,
  snapCandidates,
  snapSpan,
  snapTime,
} from "../logic/placement";
import { moveClip, trimClip } from "../timeline.commands";
import { SNAP_PX, TRIM_HANDLE_PX } from "../timeline.layout";
import type { TimelineViewState } from "../timeline.types";

type Mode = "move" | "trim-start" | "trim-end";

/** Picks the gesture from where the clip was grabbed. */
export function gestureMode(offsetX: number, width: number): Mode {
  const handle = Math.min(TRIM_HANDLE_PX, width / 4);
  if (offsetX <= handle) return "trim-start";
  if (offsetX >= width - handle) return "trim-end";
  return "move";
}

/** Finds the lane under a screen y coordinate. */
function laneAt(root: HTMLElement, clientY: number): HTMLElement | null {
  for (const lane of root.querySelectorAll<HTMLElement>("[data-track-id]")) {
    const rect = lane.getBoundingClientRect();
    if (clientY >= rect.top && clientY < rect.bottom) return lane;
  }
  return null;
}

/**
 * Runs a move or trim gesture on a clip element. Feedback is applied directly to the element's
 * style (no React renders while dragging); exactly one command is sent on release.
 */
export function startClipGesture(options: {
  bus: CommandBus;
  clip: Clip;
  element: HTMLElement;
  root: HTMLElement;
  down: PointerEvent;
  /** The timeline's view state (zoom). */
  view: StoreApi<TimelineViewState>;
  /** The playhead, a snap target. */
  playback: PlaybackClock;
}): void {
  const { bus, clip, element, root, down, view, playback } = options;
  const pxPerSecond = view.getState().pxPerSecond;
  const mode = gestureMode(down.offsetX, element.offsetWidth);
  const state = projectStore.getState();
  const threshold = pxToTime(SNAP_PX, pxPerSecond);
  const candidates = snapCandidates(state, playback.getTime(), new Set([clip.id]));
  const homeLane = element.parentElement;
  const homeTop = homeLane?.getBoundingClientRect().top ?? 0;
  const homeKind = state.tracks[clip.trackId]?.kind;

  let moved = false;
  let pending: (() => void) | null = null;

  element.setPointerCapture(down.pointerId);
  element.style.zIndex = "10";

  function onMove(e: PointerEvent): void {
    const dx = e.clientX - down.clientX;
    if (!moved && Math.abs(dx) < 3 && Math.abs(e.clientY - down.clientY) < 3) return;
    moved = true;
    const delta: Micros = pxToTime(dx, pxPerSecond);

    if (mode === "move") {
      const start = Math.max(0, snapSpan(clip.start + delta, clip.duration, candidates, threshold));
      const lane = laneAt(root, e.clientY);
      const laneTrackId = lane?.dataset.trackId;
      const targetTrackId =
        laneTrackId && state.tracks[laneTrackId]?.kind === homeKind ? laneTrackId : clip.trackId;
      const targetLane = targetTrackId === laneTrackId ? lane : homeLane;
      const valid = !findOverlap(state, targetTrackId, start, clip.duration, new Set([clip.id]));

      const offsetX = timeToPx(start - clip.start, pxPerSecond);
      const offsetY = (targetLane?.getBoundingClientRect().top ?? homeTop) - homeTop;
      element.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      element.dataset.invalid = valid ? "false" : "true";
      pending = valid
        ? () =>
            void bus.run(moveClip, {
              clipId: clip.id,
              start,
              trackId: targetTrackId === clip.trackId ? undefined : targetTrackId,
            })
        : null;
      return;
    }

    const edge = mode === "trim-start" ? "start" : "end";
    const edgeTime = edge === "start" ? clip.start : clip.start + clip.duration;
    const to = Math.max(0, snapTime(edgeTime + delta, candidates, threshold));
    const next = clampTrim(clip, edge, to, {
      mediaDuration: getProbe(clip.mediaId)?.duration ?? Number.POSITIVE_INFINITY,
      minDuration: minClipDuration(state),
      ...neighbourBounds(state, clip),
    });
    element.style.left = `${timeToPx(next.start, pxPerSecond)}px`;
    element.style.width = `${timeToPx(next.duration, pxPerSecond)}px`;
    pending = () => void bus.run(trimClip, { clipId: clip.id, edge, time: to });
  }

  function onEnd(e: PointerEvent): void {
    element.removeEventListener("pointermove", onMove);
    element.removeEventListener("pointerup", onEnd);
    element.removeEventListener("pointercancel", onEnd);
    if (element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId);
    // Restore the committed geometry; the command (if any) re-renders the clip.
    element.style.transform = "";
    element.style.zIndex = "";
    element.style.left = `${timeToPx(clip.start, pxPerSecond)}px`;
    element.style.width = `${timeToPx(clip.duration, pxPerSecond)}px`;
    delete element.dataset.invalid;
    if (moved && e.type === "pointerup") pending?.();
  }

  element.addEventListener("pointermove", onMove);
  element.addEventListener("pointerup", onEnd);
  element.addEventListener("pointercancel", onEnd);
}
