import { useImperativeHandle, useRef, type Ref } from "react";
import { correlationX, formatCorrelation, monoSafe } from "../../logic/phase";
import type { PhaseMeterHandle } from "../../sound.meter.types";
import { PanelRow } from "../card";

/**
 * The rows of "Stereo phase": the correlation of left and right over the last 400 ms and whether
 * the mix is mono safe, with a bar from −1 to +1. The Loudness tab hands it each reading
 * (`show`); it writes the DOM only, never React state (rule 24).
 */
export function PhaseMeter({ ref }: { ref?: Ref<PhaseMeterHandle> }) {
  const value = useRef<HTMLSpanElement>(null);
  const safe = useRef<HTMLSpanElement>(null);
  const marker = useRef<HTMLElement>(null);

  useImperativeHandle(ref, () => ({
    show(correlation) {
      const known = correlation !== null;
      if (value.current) value.current.textContent = known ? formatCorrelation(correlation) : "—";
      if (safe.current) {
        safe.current.textContent = known ? (monoSafe(correlation) ? "Yes" : "No") : "—";
        safe.current.dataset.tone = known ? (monoSafe(correlation) ? "good" : "bad") : "";
      }
      if (marker.current) {
        marker.current.style.visibility = known ? "visible" : "hidden";
        if (known) marker.current.style.left = `${correlationX(correlation) * 100}%`;
      }
    },
  }));

  const cell =
    "min-w-[58px] whitespace-nowrap border-b border-border-strong py-px text-right font-mono text-base font-bold";
  return (
    <>
      <PanelRow label="Correlation">
        <span ref={value} className={cell}>
          —
        </span>
      </PanelRow>
      <PanelRow label="Mono safe">
        <span
          ref={safe}
          className={`${cell} data-[tone=bad]:border-mark data-[tone=bad]:text-mark data-[tone=good]:text-on`}
        >
          —
        </span>
      </PanelRow>
      <div
        className="relative mt-1.5 h-2 border border-border-strong bg-background"
        role="img"
        aria-label="Correlation from −1 to +1"
      >
        <span className="absolute inset-y-0 left-1/2 w-px bg-border-strong" />
        <i
          ref={marker}
          className="invisible absolute -top-px bottom-[-1px] w-0.5 -translate-x-1/2 bg-foreground"
        />
      </div>
      <div className="mt-0.5 flex justify-between font-mono text-2xs text-subtle-foreground">
        <span>−1</span>
        <span>0</span>
        <span>+1</span>
      </div>
    </>
  );
}
