import { useLayoutEffect, useRef } from "react";
import { useStore } from "zustand";
import { notify, useKernel, useModule } from "@/core";
import { KeyDiamond, keyframeRef } from "@/modules/keyframe";
import { formatDb, VOLUME_DB_MAX, VOLUME_DB_MIN, type KeyTrack } from "@/modules/project";
import { pxToTime, TIMELINE_CONTENT } from "@/modules/timeline";
import { cn } from "@/ui";
import { lineDb } from "../../logic/automation";
import { levelTop, movedLine, polylineOf } from "../../logic/clipline";
import { trackLineKeys, trackLinePoints } from "../../logic/trackline";
import { moveLineKeys, setLineKey } from "../../sound.line.commands";
import { soundRef } from "../../sound.ref";
import type { LineKey, LinePoint, LineTarget } from "../../sound.line.types";
import { startLineGesture } from "./clipline.gesture";
import { TrackLineStroke } from "./TrackLineStroke";

interface TrackLineLaneProps {
  /** A track id, or "master" (the open composition's, in its `data-master-lane`). */
  target: LineTarget;
  /** The line being shown; none yet when it has no keys. */
  line: KeyTrack | undefined;
  /** The line is in front of the clips' lines: its points drag, a double-click adds one. */
  inFront: boolean;
  /** Draw volume is the tool: the lane takes strokes. */
  drawing: boolean;
  headerWidth: number;
  pxPerSecond: number;
  /** The stretch drawn, in px of the timeline. */
  from: number;
  to: number;
  /** Changes when the lanes may have moved: the lane measures again. */
  layout: number;
}

/**
 * One track's (or the master's) volume line over its lane, in the same box and taper as a clip's line: keyed points
 * as diamonds, flat at 0 dB with no keys (shown only in front). In front, a diamond drags (one
 * `sound.moveLineKeys` on release; Escape puts it back) and a double-click on the line adds a
 * point at its level there (`sound.setLineKey`), and a press selects the point (`view.linePoint`;
 * Delete is `ClipLineKeys`'s). With Draw volume, `TrackLineStroke` takes strokes. The lane's place
 * is measured from the timeline's lane.
 */
export function TrackLineLane(props: TrackLineLaneProps) {
  const { target, line, inFront, drawing, headerWidth, pxPerSecond, from, to } = props;
  const { bus } = useKernel();
  const wrapper = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const lines = useRef<(SVGPolylineElement | null)[]>([]);
  const diamonds = useRef(new Map<string, HTMLDivElement>());
  const sound = useModule(soundRef);
  const keyframes = useModule(keyframeRef).view;
  const picked = useStore(sound.view, (s) =>
    s.linePoint?.trackId === target ? s.linePoint.keyId : null,
  );

  useLayoutEffect(() => {
    const element = wrapper.current;
    const content = element?.closest<HTMLElement>(TIMELINE_CONTENT);
    if (!element || !content) return;
    const lane = content.querySelector<HTMLElement>(
      target === "master" ? "[data-master-lane]" : `[data-track-id="${CSS.escape(target)}"]`,
    );
    if (!lane) {
      element.style.visibility = "hidden";
      return;
    }
    element.style.top = `${lane.getBoundingClientRect().top - content.getBoundingClientRect().top}px`;
    element.style.height = `${lane.offsetHeight}px`;
    element.style.visibility = "visible";
  });

  const points = trackLinePoints(line, from, to, pxPerSecond);
  const keys = trackLineKeys(line, pxPerSecond).filter((key) => key.x >= from && key.x <= to);
  const end = Math.max(to, ...keys.map((key) => key.x)) + 1;

  // A drag writes the line and the diamond with attributes and `style` only (rule 24).
  const show = (key: LineKey, at: LinePoint) => {
    const polyline = polylineOf(movedLine(points, key, at));
    for (const element of lines.current) element?.setAttribute("points", polyline);
    const diamond = diamonds.current.get(key.keyId);
    if (diamond) {
      diamond.style.left = `${at.x}px`;
      diamond.style.top = `${levelTop(at.db)}%`;
    }
  };
  const press = (key: LineKey, down: PointerEvent) => {
    // One selected point at a time, across clip and track lines: Delete goes to this one.
    sound.view.setState({ linePoint: { trackId: target, keyId: key.keyId } });
    keyframes.setState({ selection: [], focused: false });
    if (!box.current) return;
    startLineGesture({
      down,
      area: box.current,
      from: key,
      width: end,
      onMove: (at) => show(key, at),
      onEnd(at) {
        if (!at || (at.x === key.x && at.db === key.db)) return show(key, key);
        const delta = pxToTime(at.x - key.x, pxPerSecond);
        // Float sums must not step past the range by a hair.
        const level = Math.min(VOLUME_DB_MAX, Math.max(VOLUME_DB_MIN, at.db));
        let deltaDb = level - key.db;
        while (key.db + deltaDb > VOLUME_DB_MAX) deltaDb -= 1e-9;
        while (key.db + deltaDb < VOLUME_DB_MIN) deltaDb += 1e-9;
        void bus
          .run(moveLineKeys, { target, keyIds: [key.keyId], delta, deltaDb })
          .then((result) => {
            if (result.ok) return;
            notify("error", result.error.message);
            show(key, key);
          });
      },
    });
  };
  const add = (clientX: number) => {
    if (!box.current) return;
    const at = Math.max(
      0,
      pxToTime(clientX - box.current.getBoundingClientRect().left, pxPerSecond),
    );
    void bus.run(setLineKey, { target, at, db: lineDb(line, at) }).then((result) => {
      if (!result.ok) notify("error", result.error.message);
    });
  };
  const shown = line !== undefined || inFront;
  const polyline = polylineOf(points);
  const editable = inFront && !drawing;
  const span = { left: from, width: Math.max(1, to - from) };
  return (
    <div ref={wrapper} className="invisible absolute right-0" style={{ left: headerWidth }}>
      <div ref={box} className="absolute inset-x-0 bottom-1 top-1">
        {shown && (
          <svg
            viewBox={`${from} 0 ${span.width} 100`}
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-y-0 overflow-visible"
            style={span}
          >
            <polyline
              ref={(element) => void (lines.current[0] = element)}
              points={polyline}
              vectorEffect="non-scaling-stroke"
              className={cn("fill-none stroke-on", !inFront && "opacity-60")}
              strokeWidth={inFront ? 1.5 : 1}
              strokeDasharray={inFront ? undefined : "4 3"}
            />
            <polyline
              ref={(element) => void (lines.current[1] = element)}
              points={polyline}
              vectorEffect="non-scaling-stroke"
              className={cn(
                "fill-none stroke-transparent",
                editable ? "[pointer-events:stroke]" : "[pointer-events:none]",
              )}
              strokeWidth={9}
              onDoubleClick={(e) => {
                e.stopPropagation();
                add(e.clientX);
              }}
            />
          </svg>
        )}
        {drawing && (
          <TrackLineStroke
            target={target}
            inFront={inFront}
            pxPerSecond={pxPerSecond}
            from={from}
            to={to}
          />
        )}
        {shown &&
          keys.map((key) => (
            <div
              key={key.keyId}
              ref={(element) => {
                if (element) diamonds.current.set(key.keyId, element);
                else diamonds.current.delete(key.keyId);
              }}
              data-clipline-point
              className={cn("absolute size-0", editable && "pointer-events-auto")}
              style={{ left: key.x, top: `${levelTop(key.db)}%` }}
              onPointerDown={(e) => {
                if (!editable || e.button !== 0) return;
                e.stopPropagation();
                press(key, e.nativeEvent);
              }}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              <KeyDiamond
                x={0}
                y={0}
                selected={picked === key.keyId}
                eased={false}
                title={`${formatDb(key.db)} dB`}
              />
            </div>
          ))}
      </div>
    </div>
  );
}
