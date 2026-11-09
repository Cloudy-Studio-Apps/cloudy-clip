import type { CorrectionValues, Wheel } from "@/modules/project";
import type { ComponentType } from "react";
import type { CurvePoint, CurveShape, ToolId } from "../../tint.types";

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

/** How a curve point is dragged: the box it moves in, the curve as it was, and where it goes. */
export interface CurveDragOptions {
  /** The pointerdown that started it, on the box. */
  event: PointerEvent;
  box: HTMLElement;
  points: readonly CurvePoint[];
  /** The point being dragged. */
  index: number;
  shape: CurveShape;
  /** Fires on every move with the points as they would be (without the point while it is off the box). */
  onMove(points: readonly CurvePoint[]): void;
  /** Fires once: the points on release, or null when Escape or the system cancelled it. */
  onEnd(points: readonly CurvePoint[] | null): void;
}

/** What the curve editor can do to its curve: live while a point moves, saved once on release. */
export interface CurveEdit {
  preview(points: readonly CurvePoint[]): void;
  commit(points: readonly CurvePoint[]): void;
  /** Drops the live value (the gesture was cancelled or changed nothing). */
  cancel(): void;
}

/** What the Warper's grid can do to the warper: live while a point moves, saved once on release. */
export interface WarperEdit {
  preview(warper: CorrectionValues["warper"]): void;
  commit(warper: CorrectionValues["warper"]): void;
  /** Drops the live value (the gesture was cancelled or changed nothing). */
  cancel(): void;
}

/** How a Warper point is dragged: the grid's SVG, the warper as it was, and the point. */
export interface WarpDragOptions {
  /** The pointerdown that started it, on the point. */
  event: PointerEvent;
  svg: SVGSVGElement;
  warper: CorrectionValues["warper"];
  index: number;
  /** Fires on every move with the warper as it would be. */
  onMove(warper: CorrectionValues["warper"]): void;
  /** Fires once: the warper on release, or null when Escape or the system cancelled it. */
  onEnd(warper: CorrectionValues["warper"] | null): void;
}

/** The Warper grid's elements its painter moves: one polygon per ring, one line per hue, one dot per point. */
export interface WarpShapes {
  rings: SVGPolygonElement[];
  spokes: SVGPolylineElement[];
  dots: SVGCircleElement[];
}
