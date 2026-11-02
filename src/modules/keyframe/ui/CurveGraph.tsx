import { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { timelineRef } from "@/modules/timeline";
import { projectRef, timeOfContent, clipEnd } from "@/modules/project";
import { moveKeys } from "../keyframe.edit.commands";
import { CURVE_KEY_RADIUS, CURVE_PADDING } from "../keyframe.layout";
import { keyframeRef } from "../keyframe.ref";
import type {
  CurveDragKey,
  CurveSource,
  KeyRef,
  PanelClip,
  ShownCurve,
  ValueScale,
} from "../keyframe.types";
import { dragPreview, keyBoxes, withScales } from "../logic/graph";
import { keysInBox, refId, toggled } from "../logic/picking";
import { startBoxSelect } from "./box.gesture";
import { drawCurves } from "./curve.draw";
import { startCurveDrag } from "./curve.gesture";
import { report } from "./panel.actions.hook";
import { PanelPlayhead } from "./PanelPlayhead";

/** How near a press must be to a key to take it, in px. */
const PICK_RADIUS = CURVE_KEY_RADIUS + 3;

/** What the drawing and the pointer read, kept current without re-attaching listeners. */
interface GraphState {
  sources: readonly CurveSource[];
  selected: ReadonlySet<string>;
  /** A drag in progress: the sources as it shows them, and the scales it began with. */
  preview?: { sources: readonly CurveSource[]; frozen: ReadonlyMap<string, ValueScale> };
}

interface CurveGraphProps {
  rows: readonly PanelClip[];
}

/**
 * The Curves view: one canvas with every shown curve. It redraws in an animation frame when the
 * project, the view, the zoom, the scroll or the size change, never per playback frame (the
 * playhead is DOM over it). Presses pick keys, draw a rubber band or drag keys in time and value.
 */
export function CurveGraph({ rows }: CurveGraphProps) {
  const { bus } = useKernel();
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

  const sources = useMemo<CurveSource[]>(() => {
    let slot = 0;
    return rows.flatMap(({ clip, fields }) =>
      fields.flatMap((field) => {
        const track = clip.animation?.[field.path];
        const mine = slot++;
        const id = `${clip.id}:${field.path}`;
        return track && track.blend === "number" && shown.includes(id)
          ? [{ id, clip, path: field.path, track, slot: mine, primary: id === primary }]
          : [];
      }),
    );
  }, [rows, shown, primary]);
  const selected = useMemo(() => new Set(selection.map(refId)), [selection]);

  useEffect(() => {
    state.current = { ...state.current, sources, selected };
    redraw.current();
  }, [sources, selected]);

  useEffect(() => {
    const root = box.current;
    const element = canvas.current;
    if (!root || !element) return;
    let frame = 0;

    const size = () => ({ width: root.clientWidth, height: root.clientHeight });
    const current = (): ShownCurve[] => {
      const { sources: list, preview } = state.current;
      return preview
        ? withScales(preview.sources, size().height, CURVE_PADDING, preview.frozen)
        : withScales(list, size().height, CURVE_PADDING);
    };
    const draw = () => {
      frame = 0;
      const { width, height } = size();
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
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    redraw.current = schedule;

    const keysAt = (curves: readonly ShownCurve[], list: readonly KeyRef[]): CurveDragKey[] => {
      const wanted = new Set(list.map(refId));
      return curves.flatMap((curve) =>
        curve.track.keys.flatMap((key) =>
          wanted.has(`${curve.clip.id}|${curve.path}|${key.id}`) && typeof key.value === "number"
            ? [
                {
                  ref: { clipId: curve.clip.id, path: curve.path, keyId: key.id },
                  moved: {
                    time: timeOfContent(curve.clip, key.t),
                    clipStart: curve.clip.start,
                    clipEnd: clipEnd(curve.clip),
                  },
                  scale: curve.scale,
                  value: key.value,
                  ...(curve.track.min !== undefined && { min: curve.track.min }),
                  ...(curve.track.max !== undefined && { max: curve.track.max }),
                },
              ]
            : [],
        ),
      );
    };

    const drag = (
      event: PointerEvent,
      curves: readonly ShownCurve[],
      list: readonly KeyRef[],
      onClick?: () => void,
    ) => {
      const keys = keysAt(curves, list);
      if (keys.length === 0) return;
      const dragged = new Set(keys.map((k) => refId(k.ref)));
      const frozen = new Map(curves.map((c) => [c.id, c.scale]));
      const base = state.current.sources;
      startCurveDrag({
        event,
        pxPerSecond: timeline.view.getState().pxPerSecond,
        keys,
        onPreview: (s) => {
          state.current = {
            ...state.current,
            preview: s
              ? { sources: dragPreview(base, dragged, s.delta, s.values), frozen }
              : undefined,
          };
          schedule();
        },
        onDrop: (s) => {
          void bus
            .run(moveKeys, {
              keys: keys.map(({ ref }) => {
                const value = s.values.get(refId(ref));
                return value === undefined ? ref : { ...ref, value };
              }),
              delta: s.delta,
            })
            .then((result) => {
              report(result);
              state.current = { ...state.current, preview: undefined };
              schedule();
            });
        },
        onClick,
      });
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const rect = element.getBoundingClientRect();
      const pxPerSecond = timeline.view.getState().pxPerSecond;
      const curves = current();
      const boxes = keyBoxes(curves, pxPerSecond, timeline.scrollLeft(), rect.width, rect);
      const additive = e.ctrlKey || e.metaKey || e.shiftKey;
      const hit = keysInBox(boxes, {
        left: e.clientX - PICK_RADIUS,
        right: e.clientX + PICK_RADIUS,
        top: e.clientY - PICK_RADIUS,
        bottom: e.clientY + PICK_RADIUS,
      }).at(-1);
      const now = view.getState().selection;
      if (hit) {
        if (additive) {
          view.setState({ selection: toggled(now, [hit]) });
          return;
        }
        const held = now.some((s) => refId(s) === refId(hit));
        const next = held ? now : [hit];
        if (!held) view.setState({ selection: next });
        drag(
          e,
          curves,
          next,
          held && now.length > 1 ? () => view.setState({ selection: [hit] }) : undefined,
        );
        return;
      }
      startBoxSelect({
        event: e,
        root,
        onDone: (area) => {
          const found = keysInBox(boxes, area);
          view.setState({
            selection: additive
              ? [...now, ...found.filter((f) => !now.some((s) => refId(s) === refId(f)))]
              : found,
          });
        },
      });
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    const offScroll = timeline.onScroll(schedule);
    const offZoom = timeline.view.subscribe(schedule);
    const offProject = project.api.subscribe(schedule);
    const offView = view.subscribe(schedule);
    element.addEventListener("pointerdown", onDown);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      redraw.current = () => undefined;
      observer.disconnect();
      offScroll();
      offZoom();
      offProject();
      offView();
      element.removeEventListener("pointerdown", onDown);
    };
  }, [bus, view, timeline, project]);

  return (
    <div ref={box} className="relative min-w-0 flex-1 overflow-hidden bg-surface-sunken">
      <canvas ref={canvas} className="absolute inset-0 size-full" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <PanelPlayhead />
      </div>
    </div>
  );
}
