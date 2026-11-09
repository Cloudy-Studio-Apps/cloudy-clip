import { useLayoutEffect, useRef } from "react";
import { WARPER_POINTS, type CorrectionValues } from "@/modules/project";
import { WARP_HUES, WARP_RINGS } from "../../logic/color/warper";
import { togglePin } from "../../logic/color/warper.edit";
import { HUE_STOPS } from "./hue.stops";
import type { WarperEdit, WarpShapes } from "./tools.types";
import { startWarpDrag } from "./warper.gesture";
import { WARP_VIEW, paintWarp } from "./warper.paint";

/** The hue circle under the grid (data colors), neutral in the middle, hues where the warper reads them. */
const DISC = `radial-gradient(circle, #d9dde0 0, rgb(217 221 224 / 0) 72%), conic-gradient(from 90deg, ${HUE_STOPS})`;

const HALF = WARP_VIEW.size / 2;

type Warper = CorrectionValues["warper"];

const same = (a: Warper, b: Warper) => JSON.stringify(a) === JSON.stringify(b);

interface WarperGridProps {
  warper: Warper;
  /** While on, a click on a point pins or unpins it instead of dragging it. */
  pinning: boolean;
  /** Makes the grid editable. Without it the grid only shows the warper. */
  edit?: WarperEdit;
}

/**
 * The warper's grid over the color circle: 12 hues by 3 rings around a fixed center. Drag a point
 * (from where it was grabbed; it starts moving after 3 px) and its neighbours follow by smoothing;
 * pinned points are hollow and don't move. While a point moves, the grid and the live values follow
 * in the DOM; the warper is saved once, on release (Escape cancels).
 */
export function WarperGrid({ warper, pinning, edit }: WarperGridProps) {
  const svg = useRef<SVGSVGElement>(null);
  const shapes = useRef<WarpShapes>({ rings: [], spokes: [], dots: [] });
  useLayoutEffect(() => paintWarp(shapes.current, warper), [warper]);

  const down = (event: React.PointerEvent, index: number) => {
    if (!edit || event.button !== 0 || !svg.current) return;
    event.preventDefault();
    event.stopPropagation();
    if (pinning) {
      edit.commit(togglePin(warper, index));
      return;
    }
    if (warper.pinned.includes(index)) return;
    startWarpDrag({
      event: event.nativeEvent,
      svg: svg.current,
      warper,
      index,
      onMove(next) {
        paintWarp(shapes.current, next);
        edit.preview(next);
      },
      onEnd(next) {
        if (next && !same(next, warper)) {
          edit.commit(next);
          return;
        }
        paintWarp(shapes.current, warper);
        edit.cancel();
      },
    });
  };

  const cursor = (index: number) =>
    !edit
      ? "cursor-default"
      : pinning
        ? "cursor-pointer"
        : warper.pinned.includes(index)
          ? "cursor-not-allowed"
          : "cursor-grab";

  return (
    <div
      className="size-[232px] rounded-full shadow-[0_0_0_1px_var(--border-strong)]"
      style={{ background: DISC }}
    >
      <svg
        ref={svg}
        viewBox={`${-HALF} ${-HALF} ${WARP_VIEW.size} ${WARP_VIEW.size}`}
        className="size-full touch-none overflow-visible"
      >
        <g stroke="rgb(20 23 27 / 0.7)" fill="none">
          {Array.from({ length: WARP_RINGS }, (_, r) => (
            <polygon
              key={r}
              ref={(el) => {
                if (el) shapes.current.rings[r] = el;
              }}
            />
          ))}
          {Array.from({ length: WARP_HUES }, (_, k) => (
            <polyline
              key={k}
              ref={(el) => {
                if (el) shapes.current.spokes[k] = el;
              }}
            />
          ))}
        </g>
        <circle r={4.5} fill="var(--foreground)" stroke="var(--background)" strokeWidth={1.5} />
        {Array.from({ length: WARPER_POINTS }, (_, i) => (
          <circle
            key={i}
            r={3.8}
            strokeWidth={1.5}
            className={cursor(i)}
            onPointerDown={(event) => down(event, i)}
            ref={(el) => {
              if (el) shapes.current.dots[i] = el;
            }}
          />
        ))}
      </svg>
    </div>
  );
}
