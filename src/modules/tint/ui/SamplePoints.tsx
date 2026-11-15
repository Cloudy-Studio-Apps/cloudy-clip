import { useRef } from "react";
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { sampleText } from "../logic/sample";
import type { FramePoint } from "../tint.types";
import { useSampleReadouts } from "./sample.readout.hook";
import { useTintSet } from "./view.set.hook";

/** Pins at most this many. */
const MAX_PINS = 3;
/** A click this close (px) to a pin takes it off. */
const GRAB = 10;
/** Hover reads at most every this many ms. */
const HOVER_EVERY = 50;

/**
 * Sample points, inside a `FrameBox`: hover shows what the picture reads under the pointer,
 * a click pins a point (up to three, kept in `view.samples`; a click on a pin takes it off), and
 * each pin's readout follows the frames. Reads are `readFrame(512)` of the live canvas, so they
 * are what the viewer shows (false color included); all text is written to the DOM, never state.
 */
export function SamplePoints({ pins }: { pins: FramePoint[] }) {
  const { picture } = useModule(previewRef);
  const set = useTintSet();
  const layer = useRef<HTMLDivElement>(null);
  const hover = useRef<HTMLSpanElement>(null);
  const rows = useRef<(HTMLElement | null)[]>([]);
  const lastHover = useRef(0);
  useSampleReadouts(pins, rows);

  const where = (event: React.PointerEvent): FramePoint | null => {
    const rect = layer.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return {
      u: (event.clientX - rect.left) / rect.width,
      v: (event.clientY - rect.top) / rect.height,
    };
  };
  const move = (event: React.PointerEvent) => {
    const at = where(event);
    if (!at || !hover.current || performance.now() - lastHover.current < HOVER_EVERY) return;
    lastHover.current = performance.now();
    const frame = picture.readFrame(512);
    hover.current.textContent = frame ? sampleText(frame, at) : "";
  };
  const click = (event: React.PointerEvent) => {
    const at = where(event);
    const rect = layer.current?.getBoundingClientRect();
    if (!at || !rect || event.button !== 0) return;
    const near = pins.findIndex(
      (p) => Math.hypot((p.u - at.u) * rect.width, (p.v - at.v) * rect.height) < GRAB,
    );
    if (near >= 0) set({ samples: pins.filter((_, i) => i !== near) });
    else if (pins.length < MAX_PINS) set({ samples: [...pins, at] });
  };
  return (
    <div
      ref={layer}
      className="pointer-events-auto absolute inset-0 cursor-crosshair"
      title="Click to pin a sample point (up to three); click a pin to remove it"
      onPointerMove={move}
      onPointerLeave={() => hover.current && (hover.current.textContent = "")}
      onPointerDown={click}
    >
      {pins.map((pin, i) => (
        <span
          key={i}
          className="pointer-events-none absolute size-3.5 -translate-1/2 rounded-full border-[1.5px] border-foreground shadow-[0_0_0_1px_black]"
          style={{ left: `${pin.u * 100}%`, top: `${pin.v * 100}%` }}
        >
          <b className="absolute -top-3.5 left-3 font-mono text-2xs text-foreground">{i + 1}</b>
        </span>
      ))}
      <div className="pointer-events-none absolute top-2 left-2 flex flex-col gap-0.5 font-mono text-xs">
        {pins.map((_, i) => (
          <span key={i} className="rounded-xs bg-surface-sunken/85 px-1.5 py-0.5">
            {i + 1}{" "}
            <span
              ref={(el) => {
                rows.current[i] = el;
              }}
            />
          </span>
        ))}
        <span ref={hover} className="rounded-xs bg-surface-sunken/85 px-1.5 empty:hidden" />
      </div>
    </div>
  );
}
