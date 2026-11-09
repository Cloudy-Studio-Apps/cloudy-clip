import { useRef } from "react";
import { useStore } from "zustand";
import { notify, useKernel, useModule } from "@/core";
import { KeyDiamond, keyframeRef, moveKeys, setKey, setKeyValues } from "@/modules/keyframe";
import { formatDb, projectRef, type Clip } from "@/modules/project";
import { pxToTime, timelineRef, timeToPx } from "@/modules/timeline";
import { cn } from "@/ui";
import {
  levelTop,
  linePoints,
  lineKeys,
  movedLine,
  polylineOf,
  VOLUME_PATH,
} from "../../logic/clipline";
import type { LineKey, LinePoint } from "../../sound.types";
import { startLineGesture } from "./clipline.gesture";

/**
 * Over a clip of an audio track: the clip's `sound.volumeDb` as a line (flat at the static level
 * when it has no keys), with a diamond for each key. Drag a diamond to move the key in time and
 * level; double-click the line to add a key where it is; a selected diamond takes Delete (see
 * `ClipLineKeys`). Everything goes through `keyframe`'s commands, one per gesture. An unkeyed line
 * shows only on a selected or hovered clip, so a plain clip stays plain.
 */
export function ClipVolumeLine({ clip, selected }: { clip: Clip; selected: boolean }) {
  const { bus } = useKernel();
  const kind = useStore(useModule(projectRef).store.api, (s) => s.tracks[clip.trackId]?.kind);
  const pxPerSecond = useStore(useModule(timelineRef).view, (s) => s.pxPerSecond);
  const timeline = useModule(timelineRef);
  const { view } = useModule(keyframeRef);
  const picked = useStore(
    view,
    (s) => s.selection.find((ref) => ref.clipId === clip.id && ref.path === VOLUME_PATH)?.keyId,
  );
  const area = useRef<HTMLDivElement>(null);
  const lines = useRef<(SVGPolylineElement | null)[]>([]);
  const diamonds = useRef(new Map<string, HTMLDivElement>());
  if (kind !== "audio") return null;

  const track = clip.animation?.[VOLUME_PATH];
  const width = Math.max(1, timeToPx(clip.duration, pxPerSecond));
  const points = linePoints(clip, track, width, pxPerSecond);
  const keys = lineKeys(clip, track, pxPerSecond);
  const keyed = keys.length > 0;
  const ease = (keyId: string) => {
    const e = track?.keys.find((k) => k.id === keyId)?.ease;
    return e !== undefined && e.kind !== "linear";
  };

  // A drag writes the line and the diamond with `style` and attributes only (rule 24).
  const show = (key: LineKey, to: LinePoint) => {
    const polyline = polylineOf(movedLine(points, key, to));
    for (const line of lines.current) line?.setAttribute("points", polyline);
    const element = diamonds.current.get(key.keyId);
    if (element) {
      element.style.left = `${to.x}px`;
      element.style.top = `${levelTop(to.db)}%`;
    }
  };
  const press = (key: LineKey, down: PointerEvent) => {
    view.setState({
      selection: [{ clipId: clip.id, path: VOLUME_PATH, keyId: key.keyId }],
      focused: true,
    });
    timeline.selectClip(clip.id);
    if (!area.current) return;
    const ref = { clipId: clip.id, path: VOLUME_PATH, keyId: key.keyId };
    startLineGesture({
      down,
      area: area.current,
      from: key,
      width,
      onMove: (to) => show(key, to),
      onEnd(to) {
        if (!to || (to.x === key.x && to.db === key.db)) return show(key, key);
        const delta = pxToTime(to.x - key.x, pxPerSecond);
        const run =
          delta !== 0
            ? bus.run(moveKeys, { keys: [{ ...ref, value: to.db }], delta })
            : bus.run(setKeyValues, { keys: [{ ...ref, value: to.db }] });
        void run.then((result) => {
          if (result.ok) return;
          notify("error", result.error.message);
          show(key, key);
        });
      },
    });
  };
  const add = (clientX: number) => {
    if (!area.current) return;
    const at =
      clip.start + pxToTime(clientX - area.current.getBoundingClientRect().left, pxPerSecond);
    void bus.run(setKey, { clipId: clip.id, path: VOLUME_PATH, at }).then((result) => {
      if (!result.ok) notify("error", result.error.message);
    });
  };

  const polyline = polylineOf(points);
  return (
    <div
      ref={area}
      className={cn(
        "absolute inset-x-0 bottom-1 top-3",
        !keyed && !selected && "opacity-0 group-hover:opacity-100",
      )}
    >
      <svg
        viewBox={`0 0 ${width} 100`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
      >
        <polyline
          ref={(element) => void (lines.current[0] = element)}
          points={polyline}
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-on"
          strokeWidth={1.5}
        />
        <polyline
          ref={(element) => void (lines.current[1] = element)}
          points={polyline}
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-transparent"
          strokeWidth={9}
          style={{ pointerEvents: "stroke" }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            add(e.clientX);
          }}
        />
      </svg>
      {keys.map((key) => (
        <div
          key={key.keyId}
          ref={(element) => {
            if (element) diamonds.current.set(key.keyId, element);
            else diamonds.current.delete(key.keyId);
          }}
          data-clipline-point
          className="pointer-events-auto absolute size-0"
          style={{ left: key.x, top: `${levelTop(key.db)}%` }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            press(key, e.nativeEvent);
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <KeyDiamond
            x={0}
            y={0}
            selected={picked === key.keyId}
            eased={ease(key.keyId)}
            title={`${formatDb(key.db)} dB`}
          />
        </div>
      ))}
    </div>
  );
}
