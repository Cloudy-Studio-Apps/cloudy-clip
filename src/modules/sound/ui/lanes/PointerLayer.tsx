import { useRef } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { compositionClips, projectRef, useOpenComposition } from "@/modules/project";
import {
  clipsInScope,
  pxToTime,
  rowsAbove,
  SNAP_PX,
  snapTime,
  TIMELINE_CONTENT,
  timelineRef,
  timeToPx,
  useHeaderWidth,
  useScrubDrag,
  useSnapCandidates,
} from "@/modules/timeline";
import { previewRef } from "@/modules/preview";
import { soundRef } from "../../sound.ref";
import { sendCut } from "./blade.gesture";
import { startFadeDrag } from "./fade.gesture";

/**
 * The Cut, Fade and Scrub tools (`timelineOverlays`, Sound page): a surface over the lanes that
 * takes the pointer while one of them is the tool, so clips, handles and lines wait for Select.
 * Cut: a click cuts the audio clip under it at the time under the pointer, snapped as a split is
 * (Ctrl/Cmd frees it); Shift cuts every clip there. Fade: a drag from a clip's nearer edge
 * (`startFadeDrag`). Scrub: a drag plays slices as the ruler does (`useScrubDrag`). Feedback is
 * written with `style` only; nothing but the cut and the fade reaches the project, once each.
 */
export function PointerLayer() {
  const tool = useStore(useModule(soundRef).view, (s) => s.tool);
  if (tool !== "cut" && tool !== "fade" && tool !== "scrub") return null;
  return <Surface tool={tool} />;
}

function Surface({ tool }: { tool: "cut" | "fade" | "scrub" }) {
  const { bus } = useKernel();
  const project = useModule(projectRef).store;
  const playback = useModule(previewRef).playback;
  const open = useOpenComposition();
  const headerWidth = useHeaderWidth();
  const pxPerSecond = useStore(useModule(timelineRef).view, (s) => s.pxPerSecond);
  const snapCandidates = useSnapCandidates();
  const scrub = useScrubDrag();
  const surface = useRef<HTMLDivElement>(null);
  const guide = useRef<HTMLDivElement>(null);
  const fade = useRef<HTMLDivElement>(null);

  /** The audio clips of the open composition. */
  const scopeClips = () => {
    const state = project.getState();
    return open ? clipsInScope(state, compositionClips(state, open.id), "sound") : [];
  };
  /** The audio clip whose box holds the point, and its box on screen. */
  const clipAt = (x: number, y: number) => {
    const content = surface.current?.closest<HTMLElement>(TIMELINE_CONTENT);
    if (!content) return null;
    const clips = scopeClips();
    for (const element of content.querySelectorAll<HTMLElement>("[data-clip-id]")) {
      const clip = clips.find((c) => c.id === element.dataset.clipId);
      const box = element.getBoundingClientRect();
      if (clip && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
        return { clip, box };
      }
    }
    return null;
  };
  const cutTime = (e: { clientX: number; ctrlKey: boolean; metaKey: boolean }) => {
    const origin = surface.current?.getBoundingClientRect().left ?? 0;
    const time = Math.max(0, pxToTime(e.clientX - origin, pxPerSecond));
    if (e.ctrlKey || e.metaKey || !open) return time;
    const candidates = snapCandidates(project.getState(), open.id, playback.getTime());
    return snapTime(time, candidates, pxToTime(SNAP_PX, pxPerSecond));
  };
  const hover = (e: React.PointerEvent) => {
    const line = guide.current;
    const area = surface.current?.getBoundingClientRect();
    if (tool !== "cut" || !line || !area) return;
    const hit = clipAt(e.clientX, e.clientY);
    if (!hit && !e.shiftKey) {
      line.style.display = "none";
      return;
    }
    // Shift cuts every track: the line runs the whole height.
    line.style.display = "block";
    line.style.left = `${timeToPx(cutTime(e), pxPerSecond)}px`;
    line.style.top = e.shiftKey || !hit ? "0px" : `${hit.box.top - area.top}px`;
    line.style.height = e.shiftKey || !hit ? "100%" : `${hit.box.height}px`;
  };
  const showFade = (box: { left: number; width: number } | null) => {
    const element = fade.current;
    const area = surface.current?.getBoundingClientRect();
    if (!element || !area) return;
    element.style.display = box ? "block" : "none";
    if (!box) return;
    element.style.left = `${box.left - area.left}px`;
    element.style.width = `${box.width}px`;
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[12]">
      <div
        ref={surface}
        className={`pointer-events-auto absolute bottom-0 right-0 ${
          tool === "cut"
            ? "cursor-crosshair"
            : tool === "fade"
              ? "cursor-ew-resize"
              : "cursor-col-resize"
        }`}
        style={{ left: headerWidth, top: rowsAbove("sound") }}
        onPointerMove={hover}
        onPointerLeave={() => void (guide.current && (guide.current.style.display = "none"))}
        onPointerDown={(e) => {
          if (e.button !== 0 || !surface.current) return;
          if (tool === "scrub") return scrub(e.nativeEvent, surface.current);
          const hit = clipAt(e.clientX, e.clientY);
          if (tool === "cut") {
            sendCut({
              bus,
              clips: scopeClips(),
              hit: hit?.clip ?? null,
              at: cutTime(e),
              every: e.shiftKey,
            });
          } else if (hit) {
            const area = surface.current.getBoundingClientRect();
            const place = (box: { left: number; width: number } | null) => {
              const element = fade.current;
              if (!element || !box) return showFade(null);
              element.style.top = `${hit.box.top - area.top}px`;
              element.style.height = `${hit.box.height}px`;
              showFade(box);
            };
            startFadeDrag({
              down: e.nativeEvent,
              bus,
              clip: hit.clip,
              box: hit.box,
              pxPerSecond,
              show: place,
            });
          }
        }}
      >
        <div
          ref={guide}
          className="pointer-events-none absolute w-px bg-mark"
          style={{ display: "none" }}
        />
        <div
          ref={fade}
          className="pointer-events-none absolute border-x border-foreground bg-background/50"
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
}
