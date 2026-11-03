import { useCallback, useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { CURVE_PADDING } from "../keyframe.layout";
import { keyframeRef } from "../keyframe.ref";
import type { GraphState, PanelClip, ShownCurve } from "../keyframe.types";
import { curveSources, withScales } from "../logic/graph";
import { refId } from "../logic/picking";
import { drawCurves } from "./curve.draw";
import { useCurvePointer } from "./curve.pointer.hook";
import { PanelPlayhead } from "./PanelPlayhead";

interface CurveGraphProps {
  rows: readonly PanelClip[];
}

/**
 * The Curves view: one canvas with every shown curve. It redraws in an animation frame when the
 * project, the view, the zoom, the scroll or the size change, never per playback frame (the
 * playhead is DOM over it). With nothing shown it draws the primary row (or the first number row).
 */
export function CurveGraph({ rows }: CurveGraphProps) {
  const { view } = useModule(keyframeRef);
  const timeline = useModule(timelineRef);
  const project = useModule(projectRef).store;
  const shown = useStore(view, (s) => s.shown);
  const primary = useStore(view, (s) => s.primary);
  const selection = useStore(view, (s) => s.selection);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef<GraphState>({ sources: [], selected: new Set() });
  const redraw = useRef<() => void>(() => undefined);
  const schedule = useCallback(() => redraw.current(), []);

  const sources = useMemo(() => curveSources(rows, shown, primary), [rows, shown, primary]);
  const selected = useMemo(() => new Set(selection.map(refId)), [selection]);

  const current = useCallback((): ShownCurve[] => {
    const height = box.current?.clientHeight ?? 0;
    const { sources: list, preview } = state.current;
    return preview
      ? withScales(preview.sources, height, CURVE_PADDING, preview.frozen)
      : withScales(list, height, CURVE_PADDING);
  }, []);

  useEffect(() => {
    state.current = { ...state.current, sources, selected };
    redraw.current();
  }, [sources, selected]);

  useEffect(() => {
    const root = box.current;
    const element = canvas.current;
    if (!root || !element) return;
    let frame = 0;
    const draw = () => {
      frame = 0;
      const width = root.clientWidth;
      const height = root.clientHeight;
      const ctx = element.getContext("2d");
      if (!ctx || width === 0 || height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(width * dpr);
      const h = Math.round(height * dpr);
      if (element.width !== w || element.height !== h) {
        element.width = w;
        element.height = h;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawCurves(ctx, {
        curves: current(),
        pxPerSecond: timeline.view.getState().pxPerSecond,
        scrollLeft: timeline.scrollLeft(),
        width,
        height,
        selection: state.current.selected,
      });
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    redraw.current = request;
    const observer = new ResizeObserver(request);
    observer.observe(root);
    const offs = [
      timeline.onScroll(request),
      timeline.view.subscribe(request),
      project.api.subscribe(request),
      view.subscribe(request),
    ];
    request();
    return () => {
      cancelAnimationFrame(frame);
      redraw.current = () => undefined;
      observer.disconnect();
      for (const off of offs) off();
    };
  }, [view, timeline, project, current]);

  useCurvePointer(canvas, box, state, current, schedule);

  return (
    <div ref={box} className="relative min-w-0 flex-1 overflow-hidden bg-surface-sunken">
      <canvas ref={canvas} className="absolute inset-0 size-full" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <PanelPlayhead />
      </div>
    </div>
  );
}
