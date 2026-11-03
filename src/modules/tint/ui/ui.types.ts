import type { ComponentType } from "react";
import type { TintView } from "../tint.types";

/** The viewer's on/off tools, by their key in the view state. */
export type ViewerToggle = keyof Pick<
  TintView,
  "compare" | "bypass" | "samples" | "falseColor" | "warning" | "guides" | "clean"
>;

/** A button of the viewer's tool bar. `side` (side by side) has no state yet. */
export interface ViewerTool {
  key: ViewerToggle | "side";
  icon: ComponentType;
  label: string;
}

/** Moves the node graph's view. Created on the graph's elements, disposed with them. */
export interface GraphCamera {
  /** Brings the whole graph back into view. */
  fit(): void;
  dispose(): void;
}
