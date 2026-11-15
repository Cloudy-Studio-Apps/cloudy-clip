import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import type { HeardFeed } from "../../sound.meter.types";
import { formatDb, VOLUME_DB_MAX, VOLUME_DB_MIN } from "@/modules/project";
import { faderDb, faderPosition } from "../../logic/fader";
import { useSliderDrag } from "../controls";

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
  /** The press, before any move. */
  onPress?(): void;
  /** The release of a press, before the commit. */
  onRelease?(): void;
  /**
   * The level is an offset on the track's volume line: the readout says so, and a thin mark on the
   * groove follows the level heard at the playhead (line plus offset), fed by `heard`.
   */
  offset?: boolean;
  heard?: HeardFeed;
  /** The meters, beside the scale. */
  children?: ReactNode;
}

/**
 * A vertical fader from −60 to +12 dB, unity at three quarters, with its scale, the meters beside
 * it and the level under it. A drag moves the handle and the level through the DOM; the level is
 * in `--mark` when it isn't 0 dB. On a track with a volume line the fader is a trim on the line:
 * the readout says "trim" and a thin `--on` mark on the groove shows the level heard at the
 * playhead. A double-click returns to 0 dB.
 */
export function Fader({
  value,
  label,
  onInput,
  onCommit,
  read,
  onPress,
  onRelease,
  offset = false,
  heard,
  children,
}: FaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const place = (db: number) => {
    if (handleRef.current) handleRef.current.style.bottom = `${faderPosition(db) * 100}%`;
    const readout = readoutRef.current;
    if (!readout) return;
    readout.textContent = offset ? `${formatDb(db)} trim` : formatDb(db);
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
    onPress,
    onRelease,
  });

  // From the document, except while a drag or its command is under way: a re-render then (the
  // strip being selected on release) must not move the handle back.
  useLayoutEffect(() => {
    if (!drag.busy()) place(value);
  });

  // The level heard, written through the DOM only when it moves (rule 24).
  useEffect(() => {
    const ghost = ghostRef.current;
    if (!heard || !offset || !ghost) return;
    let shown = -1;
    const stop = heard((db) => {
      const position = faderPosition(db);
      if (position === shown) return;
      shown = position;
      ghost.style.bottom = `${position * 100}%`;
      ghost.title = `Heard: ${formatDb(db)} dB`;
      ghost.style.visibility = "visible";
    });
    return () => {
      stop();
      ghost.style.visibility = "hidden";
    };
  }, [heard, offset]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="flex min-h-[60px] flex-1 justify-center gap-2">
        <div
          ref={trackRef}
          role="slider"
          aria-label={label}
          aria-valuemin={VOLUME_DB_MIN}
          aria-valuemax={VOLUME_DB_MAX}
          aria-valuenow={value}
          className="relative w-[18px] cursor-ns-resize touch-none before:absolute before:inset-y-0 before:left-2 before:w-0.5 before:bg-border-strong"
          onPointerDown={drag.onPointerDown}
          onDoubleClick={drag.onDoubleClick}
        >
          <div
            ref={ghostRef}
            aria-hidden
            className="invisible absolute -left-0.5 h-0.5 w-[22px] translate-y-1/2 bg-on"
          />
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
        title={
          offset
            ? "Trim: the fader raises or lowers the track's volume line by this much. The thin mark beside the handle is the level heard at the playhead."
            : undefined
        }
        className="border-b border-border-strong text-center font-mono text-sm font-bold"
      />
    </div>
  );
}
