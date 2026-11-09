import { useEffect, useRef } from "react";
import type { ClipId } from "@/modules/project";
import { useLiveEdit } from "./live.edit.hook";

interface OpacityScrubProps {
  clipId: ClipId;
  nodeId: string;
  /** Saved opacity, 0 to 1. */
  opacity: number;
  /** `nodeId` is a group's join (`tint.setGroup`). */
  group?: boolean;
}

/**
 * The opacity of a layer or a group: drag sideways to change it (one percent per pixel). While dragging, the
 * number and the picture follow through the live values; the command goes once, on release.
 */
export function OpacityScrub({ clipId, nodeId, opacity, group = false }: OpacityScrubProps) {
  const edit = useLiveEdit(clipId, nodeId, group);
  const label = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ x: number; start: number; last: number; off(): void } | null>(null);
  const show = (value: number) => {
    if (label.current) label.current.textContent = `${Math.round(value * 100)}%`;
  };
  // The saved value is the truth: undo, redo or an agent change it under the number.
  useEffect(() => show(opacity), [opacity, edit.rev]);
  const finish = (save: boolean) => {
    const at = drag.current;
    drag.current = null;
    if (!at) return;
    at.off();
    if (save && at.last !== at.start) void edit.commit({ opacity: at.last });
    else {
      edit.cancel();
      show(at.start);
    }
  };
  return (
    <span
      ref={label}
      title="Opacity: drag to change"
      className="cursor-ew-resize touch-none select-none font-mono text-xs text-muted-foreground"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const escape = (key: KeyboardEvent) => key.key === "Escape" && finish(false);
        window.addEventListener("keydown", escape, true);
        drag.current = {
          x: event.clientX,
          start: opacity,
          last: opacity,
          off: () => window.removeEventListener("keydown", escape, true),
        };
      }}
      onPointerMove={(event) => {
        const at = drag.current;
        if (!at) return;
        at.last = Math.min(
          1,
          Math.max(0, Math.round((at.start + (event.clientX - at.x) / 100) * 100) / 100),
        );
        show(at.last);
        edit.preview({ opacity: at.last });
      }}
      onPointerUp={() => finish(true)}
      onPointerCancel={() => finish(false)}
    >
      {Math.round(opacity * 100)}%
    </span>
  );
}
