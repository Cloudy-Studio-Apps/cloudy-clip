import { useMemo, useRef, type RefObject } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { projectRef, timeOfContent } from "@/modules/project";
import { timeToPx } from "@/modules/timeline";
import { scaleKeys } from "../keyframe.ease.commands";
import { keyframeRef } from "../keyframe.ref";
import { refId } from "../logic/picking";
import { selectionSpan } from "../logic/stretch";
import { SCROLLED } from "./KeyBand";
import { report } from "./panel.actions.hook";
import { startStretch } from "./stretch.gesture";

interface StretchBracketProps {
  pxPerSecond: number;
  /** The panel, where the selected diamonds are found while stretching. */
  root: RefObject<HTMLElement | null>;
}

/**
 * A thin bracket around two or more selected keys, in the plane's coordinates (it follows the
 * panel's scroll like the keys). Alt-dragging an end stretches the keys from the other end; the
 * diamonds and the bracket move in the DOM, and release sends one `keyframe.scale`. A drag without
 * Alt does nothing.
 */
export function StretchBracket({ pxPerSecond, root }: StretchBracketProps) {
  const { bus } = useKernel();
  const { view } = useModule(keyframeRef);
  const clips = useStore(useModule(projectRef).store.api, (s) => s.clips);
  const selection = useStore(view, (s) => s.selection);
  const box = useRef<HTMLDivElement>(null);
  const span = useMemo(
    () => (selection.length >= 2 ? selectionSpan(clips, selection) : undefined),
    [clips, selection],
  );
  if (!span || span.end <= span.start) return null;

  const grab = (side: "start" | "end") => (down: React.PointerEvent) => {
    down.stopPropagation();
    if (!down.altKey || down.button !== 0) return;
    down.preventDefault();
    const panel = root.current;
    const bracket = box.current;
    if (!panel || !bracket) return;
    const anchor = side === "start" ? span.end : span.start;
    const grabbed = side === "start" ? span.start : span.end;
    const times = new Map(
      selection.flatMap((ref) => {
        const clip = clips[ref.clipId];
        const key = clip?.animation?.[ref.path]?.keys.find((k) => k.id === ref.keyId);
        return clip && key ? [[refId(ref), timeOfContent(clip, key.t)] as const] : [];
      }),
    );
    const diamonds = [...panel.querySelectorAll<HTMLElement>("[data-key-ref]")].flatMap((el) => {
      const time = times.get(el.dataset.keyRef ?? "");
      return time === undefined ? [] : [{ el, time }];
    });
    const at = (time: number, factor: number) => anchor + (time - anchor) * factor;
    startStretch({
      event: down.nativeEvent,
      pxPerSecond,
      anchor,
      grabbed,
      onPreview: (factor) => {
        const f = factor ?? 1;
        const a = at(span.start, f);
        const b = at(span.end, f);
        bracket.style.left = `${timeToPx(Math.min(a, b), pxPerSecond)}px`;
        bracket.style.width = `${timeToPx(Math.abs(b - a), pxPerSecond)}px`;
        for (const { el, time } of diamonds) {
          const shift = timeToPx(at(time, f) - time, pxPerSecond);
          el.style.transform = factor === undefined ? "" : `translateX(${shift}px)`;
        }
      },
      onDrop: (factor) =>
        void bus.run(scaleKeys, { keys: selection.slice(), pivot: anchor, factor }).then(report),
    });
  };

  const grip =
    "pointer-events-auto absolute top-0 h-2.5 w-2 cursor-ew-resize border-mark hover:bg-mark/30";
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ pointerEvents: "none" }}>
      <div className="absolute inset-0 will-change-transform" style={SCROLLED}>
        <div
          ref={box}
          className="absolute inset-y-0 border-x border-t border-mark/70"
          style={{
            left: timeToPx(span.start, pxPerSecond),
            width: timeToPx(span.end - span.start, pxPerSecond),
          }}
        >
          <i
            title="Alt-drag to stretch"
            className={`${grip} -left-1 border-l`}
            onPointerDown={grab("start")}
          />
          <i
            title="Alt-drag to stretch"
            className={`${grip} -right-1 border-r`}
            onPointerDown={grab("end")}
          />
        </div>
      </div>
    </div>
  );
}
