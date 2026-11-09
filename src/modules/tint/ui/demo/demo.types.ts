/** Demo data the page is drawn from until the grade lives in the project. */

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

export interface DemoLook {
  id: string;
  name: string;
  note: string;
  look: string;
}

/** A slider row of the demo tools. */
export interface DemoField {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
}
