import { useLayoutEffect, useRef, type ReactNode } from "react";
import { faderDb, faderPosition } from "../logic/fader";
import { formatDb } from "../logic/meter";
import { useSliderDrag } from "./slider.hook";

interface FaderProps {
  /** The level the document holds, in dB. */
  value: number;
  /** Accessible name. */
  label: string;
  /** Every move of a drag: play it live, change nothing yet. Null: stop playing it live. */
  onInput(db: number | null): void;
  /** The release with a new level, or a double-click (0 dB): send the one command. */
  onCommit(db: number): Promise<void>;
  /** The level the document holds now. */
  read(): number;
  /** The meters, beside the scale. */
  children?: ReactNode;
}

/**
 * A vertical fader from −60 to +12 dB, unity at three quarters, with its scale, the meters beside
 * it and the level under it. A drag moves the handle and the level through the DOM; the level is
 * in `--mark` when it isn't 0 dB. A double-click returns to 0 dB.
 */
export function Fader({ value, label, onInput, onCommit, read, children }: FaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const place = (db: number) => {
    if (handleRef.current) handleRef.current.style.bottom = `${faderPosition(db) * 100}%`;
    const readout = readoutRef.current;
    if (!readout) return;
    readout.textContent = formatDb(db);
    readout.classList.toggle("text-mark", db !== 0);
    readout.classList.toggle("border-mark", db !== 0);
  };
  const drag = useSliderDrag({
    axis: "y",
    trackRef,
    handleRef,
    toPosition: faderPosition,
    fromPosition: faderDb,
    rest: 0,
    place,
    onInput,
    onCommit,
    read,
  });

  // From the document, except while a drag or its command is under way: a re-render then (the
  // strip being selected on release) must not move the handle back.
  useLayoutEffect(() => {
    if (!drag.busy()) place(value);
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="flex min-h-[60px] flex-1 justify-center gap-2">
        <div
          ref={trackRef}
          role="slider"
          aria-label={label}
          aria-valuemin={-60}
          aria-valuemax={12}
          aria-valuenow={value}
          className="relative w-[18px] cursor-ns-resize touch-none before:absolute before:inset-y-0 before:left-2 before:w-0.5 before:bg-border-strong"
          onPointerDown={drag.onPointerDown}
          onDoubleClick={drag.onDoubleClick}
        >
          <div
            ref={handleRef}
            className="absolute left-0 h-[11px] w-[18px] translate-y-1/2 rounded-xs bg-foreground shadow-[inset_0_-2px_0_var(--subtle-foreground)]"
          />
        </div>
        <div
          aria-hidden
          className="w-4 bg-[repeating-linear-gradient(to_bottom,var(--subtle-foreground)_0_1px,transparent_1px_12.5%)] opacity-70"
        />
        {children}
      </div>
      <div
        ref={readoutRef}
        className="border-b border-border-strong text-center font-mono text-sm font-bold"
      />
    </div>
  );
}
