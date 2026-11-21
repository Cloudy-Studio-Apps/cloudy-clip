import { useRef, useState } from "react";
import {
  formatTimecode,
  MICROS_PER_SECOND,
  notify,
  useKernel,
  useModule,
  type Micros,
} from "@/core";
import { projectRef, type Clip } from "@/modules/project";
import { neighbourBounds } from "@/modules/timeline";
import { cn } from "@/ui";
import { clampCue, MIN_CUE, parseTime } from "../logic/time";
import { subtitleRef } from "../subtitle.ref";
import { cueTimeAction } from "../subtitle.timing";
import type { CueTimeField } from "../subtitle.types";
import { report } from "@/core";

/** Pixels of drag per frame of nudge. */
const PX_PER_FRAME = 4;
/** Pixels a press must travel before it is a drag, not a click. */
const DRAG_PX = 3;

const show = (field: CueTimeField, value: Micros) =>
  field === "length" ? `${(value / MICROS_PER_SECOND).toFixed(2)} s` : formatTimecode(value);

const valueOf = (clip: Pick<Clip, "start" | "duration">, field: CueTimeField) =>
  field === "start" ? clip.start : field === "end" ? clip.start + clip.duration : clip.duration;

interface TimeFieldProps {
  clip: Clip;
  field: CueTimeField;
  /** One frame of the cue's composition, in µs: what 4 px of drag nudge. */
  frame: Micros;
  /** The edge the timing keys nudge: drawn in `--primary`. */
  active: boolean;
  className?: string;
}

/**
 * One time of a cue in the cue list: drag sideways to nudge it a frame every 4 px (shown live
 * through the DOM, one trim or move on release), or click to type one (`0:04.20` or `4.2`). A
 * value kept clear of the neighbours or `MIN_CUE` says so. Touching it makes its edge the one the
 * timing keys nudge.
 */
export function TimeField({ clip, field, frame, active, className }: TimeFieldProps) {
  const { bus } = useKernel();
  const project = useModule(projectRef).store;
  const { view } = useModule(subtitleRef);
  const [editing, setEditing] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);
  const doneRef = useRef(false);
  const value = valueOf(clip, field);
  // The text node React owns, written in place while dragging (never replaced).
  const paint = (time: Micros) => {
    const node = textRef.current?.firstChild;
    if (node) node.nodeValue = show(field, time);
  };

  /** Runs the trim or move; false when nothing changed. */
  const commit = async (to: Micros): Promise<boolean> => {
    const state = project.getState();
    const now = state.clips[clip.id];
    if (!now) return false;
    const { action, clamped } = cueTimeAction(state, now, field, to);
    if (clamped) {
      notify("info", `Kept clear of the clip next to it, and at least ${MIN_CUE / 1e6} s long`);
    }
    if (!action) return false;
    const result = await bus.execute(action.command, action.input);
    report(result);
    return result.ok;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    view.setState({ edge: field === "start" ? "start" : "end" });
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const bounds = neighbourBounds(project.getState(), clip);
    let moved = false;
    let to = value;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      if (!moved && Math.abs(dx) < DRAG_PX) return;
      moved = true;
      to = clampCue(clip, bounds, field, value + Math.round(dx / PX_PER_FRAME) * frame).time;
      paint(to);
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      if (!moved) {
        doneRef.current = false;
        setEditing(true);
      } else void commit(to).then((changed) => changed || paint(value));
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };

  if (editing) {
    const finish = (input: HTMLInputElement, save: boolean) => {
      if (doneRef.current) return;
      doneRef.current = true;
      setEditing(false);
      if (!save) return;
      const typed = parseTime(input.value);
      if (typed === null) notify("info", "Not a time: try 0:04.20 or 4.2");
      else if (typed !== value) void commit(typed);
    };
    return (
      <input
        autoFocus
        aria-label={`Cue ${field}`}
        defaultValue={
          field === "length" ? (value / MICROS_PER_SECOND).toFixed(2) : show(field, value)
        }
        onFocus={(e) => e.currentTarget.select()}
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => finish(e.currentTarget, true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape") finish(e.currentTarget, false);
        }}
        className="w-16 rounded-xs border border-primary bg-background px-0.5 font-mono text-xs font-bold text-foreground outline-none"
      />
    );
  }
  return (
    <span
      ref={textRef}
      title={`${field[0]!.toUpperCase()}${field.slice(1)}: drag to nudge, click to type`}
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "cursor-ew-resize select-none border-b border-dotted border-transparent hover:border-subtle-foreground hover:text-foreground",
        active && "border-primary text-primary",
        className,
      )}
    >
      {show(field, value)}
    </span>
  );
}
