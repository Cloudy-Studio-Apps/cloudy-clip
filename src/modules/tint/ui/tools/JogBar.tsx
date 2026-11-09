import { useRef } from "react";
import type { JogDragOptions } from "./tools.types";
import { startJogDrag } from "./jog.gesture";

interface JogBarProps {
  title: string;
  /** Width in px. */
  width: number;
  /** The saved master, -1 to 1. */
  value: number;
  disabled?: boolean;
  /** Fires on every move; the bar's own mark is already moved. */
  onMove(master: number): void;
  /** Fires once: the master on release, or null when cancelled. */
  onEnd(master: number | null): void;
}

/** A striped bar that changes a wheel's master when dragged sideways. The mark follows the pointer in the DOM. */
export function JogBar({ title, width, value, disabled, onMove, onEnd }: JogBarProps) {
  const mark = useRef<HTMLElement>(null);
  const place = (master: number) => {
    if (mark.current) mark.current.style.left = `${(master + 1) * 50}%`;
  };
  const options = (event: PointerEvent): JogDragOptions => ({
    event,
    width,
    start: value,
    onMove(master) {
      place(master);
      onMove(master);
    },
    onEnd(master) {
      if (master === null) place(value);
      onEnd(master);
    },
  });
  return (
    <span
      title={title}
      className="relative block h-3 touch-none rounded-xs bg-[repeating-linear-gradient(90deg,var(--border-strong)_0_1px,var(--surface-sunken)_1px_4px)] data-[disabled=true]:opacity-50 not-data-[disabled=true]:cursor-ew-resize"
      data-disabled={disabled}
      style={{ width }}
      onPointerDown={(event) => {
        if (disabled) return;
        event.preventDefault();
        startJogDrag(options(event.nativeEvent));
      }}
    >
      <i
        ref={mark}
        className="absolute inset-y-0 block w-[3px] -translate-x-1/2 rounded-[1px] bg-foreground"
        style={{ left: `${(value + 1) * 50}%` }}
      />
    </span>
  );
}
