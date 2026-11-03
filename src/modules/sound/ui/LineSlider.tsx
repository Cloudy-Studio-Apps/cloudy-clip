import { useLayoutEffect, useRef } from "react";
import { cn } from "@/ui";
import { useSliderDrag } from "./slider.hook";

interface LineSliderProps {
  value: number;
  /** Accessible name. */
  label: string;
  /** Where a value sits along the line, 0 to 1. */
  toPosition(value: number): number;
  /** The value at a position along the line. */
  fromPosition(position: number): number;
  /** What a double-click returns to. Away from it, the thumb is in `--mark`. */
  rest: number;
  /** The value for people, as the tooltip. */
  format(value: number): string;
  /** A tick at the middle (the pan's centre); otherwise the line fills up to the thumb. */
  centred?: boolean;
  /** Every move of a drag: play it live. Null: stop playing it live. */
  onInput(value: number | null): void;
  /** The release with a new value, or a double-click: send the one command. */
  onCommit(value: number): Promise<void>;
  /** The value the document (or the monitor) holds now. */
  read(): number;
  className?: string;
}

/** A thin horizontal line with a round thumb, dragged without React renders: the pan, the speaker. */
export function LineSlider({
  value,
  label,
  toPosition,
  fromPosition,
  rest,
  format,
  centred = false,
  onInput,
  onCommit,
  read,
  className,
}: LineSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const place = (next: number) => {
    const percent = `${toPosition(next) * 100}%`;
    const thumb = handleRef.current;
    if (thumb) {
      thumb.style.left = percent;
      thumb.classList.toggle("bg-mark", next !== rest);
      thumb.classList.toggle("bg-foreground", next === rest);
    }
    if (fillRef.current) fillRef.current.style.width = percent;
    if (trackRef.current) trackRef.current.title = `${label}: ${format(next)}`;
  };
  const drag = useSliderDrag({
    axis: "x",
    trackRef,
    handleRef,
    toPosition,
    fromPosition,
    rest,
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
    <div
      ref={trackRef}
      role="slider"
      aria-label={label}
      aria-valuenow={value}
      aria-valuetext={format(value)}
      className={cn("relative h-3.5 shrink-0 cursor-ew-resize touch-none", className)}
      onPointerDown={drag.onPointerDown}
      onDoubleClick={drag.onDoubleClick}
    >
      <div className="absolute inset-x-0 top-1.5 h-0.5 bg-border-strong" />
      {centred ? (
        <div className="absolute left-1/2 top-[3px] h-2 w-px bg-subtle-foreground" />
      ) : (
        <div ref={fillRef} className="absolute left-0 top-1.5 h-0.5 bg-foreground" />
      )}
      <div
        ref={handleRef}
        className="absolute top-px z-10 -ml-1.5 size-3 rounded-full bg-foreground"
      />
    </div>
  );
}
