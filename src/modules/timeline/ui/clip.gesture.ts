import type { CommandBus, Micros, PatchableStore } from "@/core";
import type { StoreApi } from "zustand/vanilla";
import { partnersOf, type Clip, type ProjectState, compositionOf } from "@/modules/project";
import type { MediaApi } from "@/modules/media";
import type { PlaybackClock } from "@/modules/preview";
import { pxToTime, timeToPx } from "../logic/geometry";
import { clampTrim, findOverlap, snapCandidates, snapSpan, snapTime } from "../logic/placement";
import { linkedTrimEdge, trimLimits } from "../logic/trim";
import { moveClip, trimClip } from "../timeline.commands";
import { SNAP_PX, TRIM_HANDLE_PX } from "../timeline.layout";
import type { ClipGestureMode, JunctionKindOf, TimelineViewState } from "../timeline.types";

/** Picks the gesture from where the clip was grabbed. */
export function gestureMode(offsetX: number, width: number): ClipGestureMode {
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
  /** Media metadata, to clamp trims to the source length. */
  media: MediaApi;
  /** The project document, read for snapping and track kinds. */
  project: PatchableStore<ProjectState>;
  /** The junction kinds, so a move that resizes a joined overlap within limits stays valid. */
  kindOf: JunctionKindOf;
}): void {
  const { bus, clip, element, root, down, view, playback, media, project, kindOf } = options;
  const pxPerSecond = view.getState().pxPerSecond;
  const mode = gestureMode(down.offsetX, element.offsetWidth);
  const state = project.getState();
  const threshold = pxToTime(SNAP_PX, pxPerSecond);
  // Linked clips (a video's picture and sound) follow the dragged one.
  const partners = partnersOf(state, clip.id).map((partner) => ({
    clip: partner,
    element: root.querySelector<HTMLElement>(`[data-clip-id="${partner.id}"]`),
  }));
  const group = [clip, ...partners.map((p) => p.clip)];
  const groupIds = new Set(group.map((c) => c.id));
  const durationOf = (id: string) => media.getProbe(id)?.duration;
  const candidates = snapCandidates(
    state,
    compositionOf(state, state.tracks[clip.trackId]!).id,
    playback.getTime(),
    groupIds,
  );
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
      const shift = start - clip.start;
      const valid =
        !findOverlap(state, targetTrackId, start, clip.duration, groupIds, clip, kindOf) &&
        partners.every(
          ({ clip: p }) =>
            p.start + shift >= 0 &&
            !findOverlap(state, p.trackId, p.start + shift, p.duration, groupIds, p, kindOf),
        );

      const offsetX = timeToPx(shift, pxPerSecond);
      const offsetY = (targetLane?.getBoundingClientRect().top ?? homeTop) - homeTop;
      element.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      element.dataset.invalid = valid ? "false" : "true";
      for (const { element: partner } of partners) {
        if (!partner) continue;
        partner.style.transform = `translate(${offsetX}px, 0)`;
        partner.dataset.invalid = element.dataset.invalid;
      }
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
    const shared = linkedTrimEdge(state, group, edge, to, durationOf);
    const show = (c: Clip, el: HTMLElement | null) => {
      if (!el) return;
      const next = clampTrim(c, edge, shared, trimLimits(state, c, durationOf, edge));
      el.style.left = `${timeToPx(next.start, pxPerSecond)}px`;
      el.style.width = `${timeToPx(next.duration, pxPerSecond)}px`;
    };
    show(clip, element);
    for (const partner of partners) show(partner.clip, partner.element);
    pending = () => void bus.run(trimClip, { clipId: clip.id, edge, time: to });
  }

  function onEnd(e: PointerEvent): void {
    element.removeEventListener("pointermove", onMove);
    element.removeEventListener("pointerup", onEnd);
    element.removeEventListener("pointercancel", onEnd);
    if (element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId);
    // Restore the committed geometry; the command (if any) re-renders the clip.
    element.style.zIndex = "";
    for (const [c, el] of [
      [clip, element] as const,
      ...partners.map((p) => [p.clip, p.element] as const),
    ]) {
      if (!el) continue;
      el.style.transform = "";
      el.style.left = `${timeToPx(c.start, pxPerSecond)}px`;
      el.style.width = `${timeToPx(c.duration, pxPerSecond)}px`;
      delete el.dataset.invalid;
    }
    if (moved && e.type === "pointerup") pending?.();
  }

  element.addEventListener("pointermove", onMove);
  element.addEventListener("pointerup", onEnd);
  element.addEventListener("pointercancel", onEnd);
}
