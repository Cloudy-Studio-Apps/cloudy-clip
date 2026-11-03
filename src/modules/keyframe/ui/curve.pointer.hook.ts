import { useEffect, type MutableRefObject, type RefObject } from "react";
import { useKernel, useModule } from "@/core";
import { timelineRef } from "@/modules/timeline";
import { moveKeys } from "../keyframe.edit.commands";
import { setEase } from "../keyframe.ease.commands";
import { CURVE_HANDLE_RADIUS, CURVE_KEY_RADIUS } from "../keyframe.layout";
import { keyframeRef } from "../keyframe.ref";
import type { GraphState, KeyRef, ShownCurve } from "../keyframe.types";
import { dragKeys, dragPreview, keyBoxes } from "../logic/graph";
import { handleDrag, handleSpots, withEases } from "../logic/handles";
import { keysInBox, parseRef, refId, toggled } from "../logic/picking";
import { startBoxSelect } from "./box.gesture";
import { startCurveDrag } from "./curve.gesture";
import { startHandleDrag } from "./handle.gesture";
import { report } from "./panel.actions.hook";
import { useKeySnap } from "./snap.hook";

/** How near a press must be to a key to take it, in px. */
const PICK_RADIUS = CURVE_KEY_RADIUS + 3;

/** How near a press must be to a handle to take it, in px. */
const HANDLE_PICK_RADIUS = CURVE_HANDLE_RADIUS + 3;

/**
 * The graph's presses: on a handle of a selected key, shape its ease; on a key, select it (Ctrl/Shift toggles) and drag the selection in time
 * and value; on empty plane, a rubber band. A drag shows through `state.preview` and sends one
 * `keyframe.move` (or `keyframe.setEase` for a handle) on release.
 */
export function useCurvePointer(
  canvas: RefObject<HTMLCanvasElement | null>,
  root: RefObject<HTMLElement | null>,
  state: MutableRefObject<GraphState>,
  current: () => ShownCurve[],
  schedule: () => void,
): void {
  const { bus } = useKernel();
  const { view } = useModule(keyframeRef);
  const timeline = useModule(timelineRef);
  const snapFor = useKeySnap();

  useEffect(() => {
    const element = canvas.current;
    const area = root.current;
    if (!element || !area) return;

    const drag = (
      event: PointerEvent,
      curves: readonly ShownCurve[],
      list: readonly KeyRef[],
      onClick?: () => void,
    ) => {
      const keys = dragKeys(curves, list);
      if (keys.length === 0) return;
      const dragged = new Set(keys.map((k) => refId(k.ref)));
      const frozen = new Map(curves.map((c) => [c.id, c.scale]));
      const base = state.current.sources;
      startCurveDrag({
        event,
        pxPerSecond: timeline.view.getState().pxPerSecond,
        keys,
        snap: snapFor(list),
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

    const dragHandle = (e: PointerEvent, curves: readonly ShownCurve[], rect: DOMRect) => {
      const { pxPerSecond } = timeline.view.getState();
      const scrollLeft = timeline.scrollLeft();
      const selected = state.current.selected;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const spot = curves
        .flatMap((curve) =>
          handleSpots(curve, selected, pxPerSecond, scrollLeft).map((s) => ({ s, curve })),
        )
        .filter(({ s }) => Math.hypot(s.x - x, s.y - y) <= HANDLE_PICK_RADIUS)
        .at(-1);
      if (!spot) return false;
      const frozen = new Map(curves.map((c) => [c.id, c.scale]));
      const base = state.current.sources;
      startHandleDrag({
        event: e,
        resolve: handleDrag(spot.s, spot.curve.scale, pxPerSecond, scrollLeft),
        onPreview: (eases) => {
          state.current = {
            ...state.current,
            preview: eases ? { sources: withEases(base, eases), frozen } : undefined,
          };
          schedule();
        },
        onDrop: (eases) => {
          void bus
            .run(setEase, {
              changes: [...eases].flatMap(([id, ease]) => {
                const key = parseRef(id);
                return key ? [{ key, ease }] : [];
              }),
            })
            .then((result) => {
              report(result);
              state.current = { ...state.current, preview: undefined };
              schedule();
            });
        },
      });
      return true;
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const rect = element.getBoundingClientRect();
      const curves = current();
      if (dragHandle(e, curves, rect)) return;
      const boxes = keyBoxes(
        curves,
        timeline.view.getState().pxPerSecond,
        timeline.scrollLeft(),
        rect.width,
        rect,
      );
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
        root: area,
        onDone: (found) => {
          const picked = keysInBox(boxes, found);
          view.setState({
            selection: additive
              ? [...now, ...picked.filter((f) => !now.some((s) => refId(s) === refId(f)))]
              : picked,
          });
        },
      });
    };

    element.addEventListener("pointerdown", onDown);
    return () => element.removeEventListener("pointerdown", onDown);
  }, [bus, view, timeline, canvas, root, state, current, schedule, snapFor]);
}
