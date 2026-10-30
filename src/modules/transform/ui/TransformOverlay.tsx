import { useMemo, useRef } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { clipPlacement, projectRef, useOpenFormat } from "@/modules/project";
import { selectionSubject, timelineRef } from "@/modules/timeline";
import { topmostAt } from "../logic/picking";
import type { TransformGestureMode } from "../transform.types";
import { toFramePoint } from "../logic/frame";
import { SelectionBox } from "./SelectionBox";
import { startTransformGesture } from "./transform.gesture";
import { useVisibleLayers } from "./layers.hook";

/**
 * Canvas tools over the preview frame: click a picture to select its clip, then move, scale or
 * rotate it. Click empty space to deselect.
 */
export function TransformOverlay() {
  const project = useModule(projectRef).store;
  const timeline = useModule(timelineRef);
  const preview = useModule(previewRef);
  const { bus } = useKernel();
  const frameRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const verticalRef = useRef<HTMLDivElement>(null);
  const horizontalRef = useRef<HTMLDivElement>(null);

  const layers = useVisibleLayers();
  const format = useOpenFormat();
  const clips = useStore(project.api, (s) => s.clips);
  const selection = useStore(timeline.view, (s) => s.selection);

  const placed = useMemo(
    () =>
      layers.flatMap((layer) =>
        clips[layer.clipId]
          ? [
              {
                ...layer,
                placement: clipPlacement(format, layer.source, layer.transform, layer.fit),
              },
            ]
          : [],
      ),
    [layers, clips, format],
  );
  // One clip, or one linked picture + sound: the box goes on the selected picture.
  const hasSubject = useStore(project.api, (s) => selectionSubject(s, selection) !== undefined);
  const selected = hasSubject
    ? placed.find((layer) => selection.includes(layer.clipId))
    : undefined;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const frame = frameRef.current;
    if (e.button !== 0 || !frame) return;
    const handle = (e.target as HTMLElement).dataset.handle as TransformGestureMode | undefined;
    let target = handle && handle !== "move" ? selected : undefined;
    let mode: TransformGestureMode = handle === "scale" || handle === "rotate" ? handle : "move";

    if (!target) {
      const point = toFramePoint(frame, format, e.clientX, e.clientY);
      const index = topmostAt(
        placed.map((layer) => layer.placement),
        point,
      );
      // Keep dragging the selected picture when it is under the pointer, even if covered.
      target = selected && handle === "move" ? selected : placed[index];
      mode = "move";
      if (!target) {
        timeline.selectClip(null);
        return;
      }
      if (target !== selected) timeline.selectClip(target.clipId);
    }

    e.preventDefault();
    e.stopPropagation();
    // A click still selects; a picture that can't move isn't dragged.
    if (mode === "move" && !target.fields.has("x") && !target.fields.has("y")) return;
    startTransformGesture({
      mode,
      clipId: target.clipId,
      start: target.transform,
      source: target.source,
      fit: target.fit,
      fields: target.fields,
      format,
      frame,
      box: target === selected ? boxRef.current : null,
      guides: { vertical: verticalRef.current, horizontal: horizontalRef.current },
      down: e.nativeEvent,
      preview,
      bus,
    });
  };

  return (
    <div
      ref={frameRef}
      className="pointer-events-auto absolute inset-0"
      onPointerDown={onPointerDown}
    >
      <div
        ref={verticalRef}
        hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-blush-400"
      />
      <div
        ref={horizontalRef}
        hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-blush-400"
      />
      {selected && (
        <SelectionBox
          key={selected.clipId}
          ref={boxRef}
          placement={selected.placement}
          format={format}
          handles={{
            scale: selected.fields.has("scale"),
            rotate: selected.fields.has("rotation"),
          }}
        />
      )}
    </div>
  );
}
