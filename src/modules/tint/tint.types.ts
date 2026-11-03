import type { StoreApi } from "zustand";

/** How the grade is shown: as layers (Baby Seal) or as nodes (Leader Seal). */
export type TintMode = "baby" | "leader";

/** The tools in the rail, in rail order. */
export type ToolId =
  | "basics"
  | "wheels"
  | "curves"
  | "cmix"
  | "warper"
  | "creative"
  | "limit"
  | "luts"
  | "match"
  | "mixer";

/** The four ways the Wheels tool shows its wheels. */
export type WheelsMode = "primary" | "log" | "bars" | "zones";

/** Which grade the page edits: the clip's, its shot group's, or the whole timeline's. */
export type GradeLevel = "clip" | "group" | "timeline";

/** The main scope beside the vectorscope. */
export type ScopeKind = "parade" | "wave" | "hist";

/** The curve the Curves tool shows. */
export type CurveKind = "custom" | "hueHue" | "hueSat" | "hueLum" | "lumSat";

/** What the left panel shows. */
export type GradeTab = "grade" | "looks";

/** The page's view state, per kernel and never in history. */
export interface TintView {
  mode: TintMode;
  tool: ToolId;
  wheels: WheelsMode;
  level: GradeLevel;
  scope: ScopeKind;
  curve: CurveKind;
  leftTab: GradeTab;
  /** The layer or node being edited. */
  selected: string | null;
  /** Index into the Color mix families. */
  family: number;
  bypass: boolean;
  compare: boolean;
  falseColor: boolean;
  warning: boolean;
  guides: boolean;
  samples: boolean;
  /** The viewer fills the window. */
  clean: boolean;
}

/** The tint module's API for one kernel. */
export interface TintApi {
  /** The page's view state. Read with `useStore(api.view, selector)`. */
  readonly view: StoreApi<TintView>;
}

/** A point in the node graph, in graph units. */
export type GraphPoint = readonly [number, number];

/** A node's place and shape in the graph. */
export interface GraphPlaced {
  kind: string;
  x: number;
  y: number;
}

/** A curve point, x and y in 0..1. */
export type CurvePoint = readonly [number, number];
