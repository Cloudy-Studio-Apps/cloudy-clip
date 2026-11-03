/** Demo data the page is drawn from until the grade lives in the project. */

/** What a layer's chip says it is limited to. */
export interface DemoChip {
  kind: "whole" | "key" | "lut" | "agent";
  label: string;
}

export interface DemoLayer {
  type: "layer";
  id: string;
  no: string;
  name: string;
  on: boolean;
  opacity: number;
  chip: DemoChip;
  /** CSS filter that stands in for the picture at this layer. */
  look: string;
}

export interface DemoGroup {
  type: "group";
  id: string;
  name: string;
  /** Side by side, stacked, or per channel. */
  kind: "parallel" | "layer" | "channels";
  on: boolean;
  opacity: number;
  layers: DemoLayer[];
}

export interface DemoSealed {
  type: "sealed";
  id: string;
  name: string;
  nodes: number;
  on: boolean;
  layers: DemoLayer[];
}

export type DemoItem = DemoLayer | DemoGroup | DemoSealed;

/** A node of the demo graph, in graph units (the SVG's view box). */
export interface DemoNode {
  id: string;
  kind: "correct" | "join" | "split" | "merge" | "channel";
  label: string;
  x: number;
  y: number;
  no?: string;
  badge?: "KEY" | "LUT";
  channel?: "r" | "g" | "b";
  /** The layer this node is, so selecting one selects the other. */
  layer?: string;
}

export interface DemoWire {
  from: string;
  to: string;
  kind: "picture" | "r" | "g" | "b";
}

/** A dashed box around nodes that Baby Seal shows as one thing. */
export interface DemoRegion {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DemoClip {
  id: string;
  no: string;
  name: string;
  track: "V1" | "V2";
  start: string;
  /** Where it sits on the timeline, in seconds. */
  from: number;
  to: number;
  meta: string;
  graded: boolean;
  image: string;
}

export interface DemoLook {
  id: string;
  name: string;
  note: string;
  look: string;
}

/** A wheel's four numbers (master, red, green, blue), its puck and master ring. */
export interface DemoWheel {
  label: string;
  x: number;
  y: number;
  numbers: [number, number, number, number];
  master: number;
}

/** A slider row of the demo tools. */
export interface DemoField {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
}
