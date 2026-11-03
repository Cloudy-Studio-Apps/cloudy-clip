import { useMemo, useRef } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { projectRef, useOpenFormat } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { setKeyValues } from "../keyframe.edit.commands";
import { keyframeRef } from "../keyframe.ref";
import { motionPath } from "../logic/motion";
import { refId } from "../logic/picking";
import type { FramePoint, MotionPathShape } from "../keyframe.types";
import { startMotionDrag } from "./motion.gesture";
import { report } from "./panel.actions.hook";

/** Points the path is drawn with. */
const SAMPLES = 120;

/**
 * The selected clip's position path over the preview frame, with a diamond at each key time that
 * can be dragged. DOM only, so it never reaches a capture or an export.
 */
export function MotionPath() {
  const { bus } = useKernel();
  const { view } = useModule(keyframeRef);
  const project = useModule(projectRef).store;
  const timeline = useModule(timelineRef);
  const format = useOpenFormat();
  const frameRef = useRef<HTMLDivElement>(null);
  const open = useStore(view, (s) => s.mode !== "normal" && s.motionPath);
  const clips = useStore(project.api, (s) => s.clips);
  const selection = useStore(timeline.view, (s) => s.selection);

  const shape: MotionPathShape | undefined = useMemo(() => {
    if (!open) return undefined;
    const animated = selection.flatMap((id) => {
      const clip = clips[id];
      return clip?.animation?.["transform.x"] || clip?.animation?.["transform.y"] ? [clip] : [];
    });
    const [only] = animated;
    return animated.length === 1 && only ? motionPath(only, format, SAMPLES) : undefined;
  }, [open, clips, selection, format]);

  if (!shape || shape.points.length === 0) return null;
  const percent = (p: FramePoint) => ({
    left: `${(p.x / format.width) * 100}%`,
    top: `${(p.y / format.height) * 100}%`,
  });

  const onDown = (e: React.PointerEvent<HTMLElement>, key: MotionPathShape["keys"][number]) => {
    const frame = frameRef.current;
    if (e.button !== 0 || !frame) return;
    e.preventDefault();
    e.stopPropagation();
    const diamond = e.currentTarget;
    view.setState({ selection: key.ref });
    startMotionDrag({
      event: e.nativeEvent,
      frame,
      size: format,
      diamond,
      at: key.at,
      axes: {
        x: key.ref.some((ref) => ref.path === "transform.x"),
        y: key.ref.some((ref) => ref.path === "transform.y"),
      },
      onDrop(delta) {
        const keys = key.ref.map((ref) => ({
          ...ref,
          offset: ref.path === "transform.x" ? delta.x : delta.y,
        }));
        void bus.run(setKeyValues, { keys }).then((result) => {
          if (!result.ok) {
            const spot = percent(key.at);
            diamond.style.left = spot.left;
            diamond.style.top = spot.top;
          }
          report(result);
        });
      },
    });
  };

  return (
    <div ref={frameRef} className="pointer-events-none absolute inset-0">
      <svg
        className="absolute inset-0 size-full overflow-visible"
        viewBox={`0 0 ${format.width} ${format.height}`}
        preserveAspectRatio="none"
      >
        <polyline
          points={shape.points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          className="stroke-primary"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {shape.keys.map((key) => (
        <i
          key={key.ref.map(refId).join(",")}
          data-motion-key
          title="Drag to move this key"
          className="pointer-events-auto absolute -ml-[5px] -mt-[5px] block size-2.5 rotate-45 cursor-move bg-primary shadow-[0_0_0_1px_var(--background)]"
          style={percent(key.at)}
          onPointerDown={(e) => onDown(e, key)}
        />
      ))}
    </div>
  );
}
