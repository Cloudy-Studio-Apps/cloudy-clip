import type { Wheel } from "@/modules/project";
import type { ComponentType } from "react";
import type { ToolId } from "../../tint.types";

/** A tool in the rail: its icon, name, what it's for, its key, and the body it shows. */
export interface ToolEntry {
  id: ToolId;
  name: string;
  tip: string;
  key?: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType;
}

/** What a wheel can do to its value: live while the puck moves, saved once on release. */
export interface WheelEdit {
  preview(wheel: Wheel): void;
  commit(wheel: Wheel): void;
  /** Drops the live value (the gesture was cancelled). */
  cancel(): void;
  /** Puts the wheel back to neutral. */
  reset(): void;
}

/** How a wheel's puck is dragged: the ring it sits in, the wheel as it was, and where it goes. */
export interface WheelDragOptions {
  /** The pointerdown that started it, on the ring. */
  event: PointerEvent;
  ring: HTMLElement;
  wheel: Wheel;
  /** Fires on every move, with the wheel the pointer points at. */
  onMove(wheel: Wheel): void;
  /** Fires once: the wheel on release, or null when Escape or the system cancelled it. */
  onEnd(wheel: Wheel | null): void;
}

/** How the master jog bar is dragged. */
export interface JogDragOptions {
  event: PointerEvent;
  /** Width of the bar, in px: dragging all across moves the master by 2. */
  width: number;
  start: number;
  onMove(master: number): void;
  /** The master on release, or null when cancelled. */
  onEnd(master: number | null): void;
}

/** The plain number fields of a correction that a slider edits. */
export type ScalarKey =
  | "exposure"
  | "contrast"
  | "pivot"
  | "highlights"
  | "shadows"
  | "whites"
  | "blacks"
  | "temperature"
  | "tint"
  | "vibrance"
  | "saturation"
  | "hue"
  | "rolloff";

/** A slider row of Basics or the wheels' side: which field, its label and its step. */
export interface BasicField {
  key: ScalarKey;
  label: string;
  step: number;
}
